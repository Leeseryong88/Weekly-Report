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

const VALID_ROLES: UserRole[] = ["admin", "part_leader", "team_leader", "member"];

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hasOwn(body: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key);
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
    const body = (await request.json()) as Record<string, unknown>;
    const firestoreUpdates: Record<string, unknown> = {};
    const authUpdates: Parameters<typeof adminAuth.updateUser>[1] = {};

    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    const currentEmail = (userDoc.data()?.email as string | undefined)?.trim();

    if (hasOwn(body, "email")) {
      const email = typeof body.email === "string" ? body.email.trim() : "";
      if (!email) {
        return NextResponse.json({ error: "이메일은 필수입니다." }, { status: 400 });
      }
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: "올바른 이메일 형식이 아닙니다." }, { status: 400 });
      }
      if (currentEmail !== email) {
        authUpdates.email = email;
        authUpdates.emailVerified = true;
        firestoreUpdates.email = email;
      }
    }

    if (hasOwn(body, "role")) {
      if (!VALID_ROLES.includes(body.role as UserRole)) {
        return NextResponse.json({ error: "올바르지 않은 권한입니다." }, { status: 400 });
      }
      firestoreUpdates.role = body.role as UserRole;
    }

    if (hasOwn(body, "teamId")) {
      if (body.teamId !== null && typeof body.teamId !== "string") {
        return NextResponse.json({ error: "올바르지 않은 팀 정보입니다." }, { status: 400 });
      }
      const teamId = typeof body.teamId === "string" ? body.teamId.trim() : null;
      firestoreUpdates.teamId = teamId || null;
    }

    if (hasOwn(body, "isActive")) {
      if (typeof body.isActive !== "boolean") {
        return NextResponse.json({ error: "올바르지 않은 계정 상태입니다." }, { status: 400 });
      }
      if (uid === auth.uid && body.isActive === false) {
        return NextResponse.json({ error: "현재 로그인한 관리자 계정은 비활성화할 수 없습니다." }, { status: 400 });
      }
      firestoreUpdates.isActive = body.isActive;
      authUpdates.disabled = !body.isActive;
    }

    if (Object.keys(authUpdates).length > 0) {
      await adminAuth.updateUser(uid, authUpdates);
    }

    if (Object.keys(firestoreUpdates).length > 0) {
      await adminDb.collection("users").doc(uid).update({
        ...firestoreUpdates,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({
      uid,
      email: (firestoreUpdates.email as string | undefined) ?? currentEmail,
      ...firestoreUpdates,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "사용자 정보 변경 실패";
    if (message.includes("email-already-exists")) {
      return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
    }
    if (message.includes("user-not-found")) {
      return NextResponse.json({ error: "Firebase Auth 사용자를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
