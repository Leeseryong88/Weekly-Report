import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  verifyAuthToken,
  verifyErrorMessage,
  isAdminSdkConfigured,
  adminAuth,
  adminDb,
} from "@/lib/firebase-admin";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  if (!isAdminSdkConfigured()) {
    return NextResponse.json(
      {
        error:
          "서버 Firebase Admin 설정이 없습니다. .env.local에 FIREBASE_SERVICE_ACCOUNT_KEY 또는 FIREBASE_SERVICE_ACCOUNT_PATH를 추가하고 dev 서버를 재시작하세요.",
      },
      { status: 503 }
    );
  }

  const auth = await verifyAuthToken(request.headers.get("Authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: verifyErrorMessage(auth) }, { status: 403 });
  }
  if (auth.role !== "admin") {
    return NextResponse.json(
      { error: `관리자 권한이 필요합니다. (현재 권한: ${auth.role})` },
      { status: 403 }
    );
  }

  const { uid } = await params;

  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";

    if (!email) {
      return NextResponse.json({ error: "이메일은 필수입니다." }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "올바른 이메일 형식이 아닙니다." }, { status: 400 });
    }

    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    const currentEmail = (userDoc.data()?.email as string | undefined)?.trim();
    if (currentEmail === email) {
      return NextResponse.json({ uid, email });
    }

    await adminAuth.updateUser(uid, {
      email,
      emailVerified: true,
    });

    await adminDb.collection("users").doc(uid).update({
      email,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ uid, email });
  } catch (err) {
    const message = err instanceof Error ? err.message : "이메일 변경 실패";
    if (message.includes("email-already-exists")) {
      return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
    }
    if (message.includes("user-not-found")) {
      return NextResponse.json({ error: "Firebase Auth 사용자를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
