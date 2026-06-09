import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  verifyAuthToken,
  verifyErrorMessage,
  isAdminSdkConfigured,
  adminAuth,
  adminDb,
} from "@/lib/firebase-admin";
import type { UserRole } from "@/types";

export async function POST(request: Request) {
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

  try {
    const body = await request.json();
    const { name, email, password, role, teamId } = body as {
      name: string;
      email: string;
      password: string;
      role: UserRole;
      teamId: string | null;
    };

    if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
      return NextResponse.json(
        { error: "이름, 이메일, 비밀번호(6자 이상)는 필수입니다." },
        { status: 400 }
      );
    }

    const validRoles: UserRole[] = ["admin", "part_leader", "team_leader", "member"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "올바르지 않은 권한입니다." }, { status: 400 });
    }

    const authUser = await adminAuth.createUser({
      email: email.trim(),
      password,
      displayName: name.trim(),
    });

    await adminDb.collection("users").doc(authUser.uid).set({
      name: name.trim(),
      email: email.trim(),
      role,
      teamId: teamId || null,
      isActive: true,
      mustChangePassword: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ uid: authUser.uid, email: authUser.email });
  } catch (err) {
    const message = err instanceof Error ? err.message : "계정 생성 실패";
    if (message.includes("email-already-exists")) {
      return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
