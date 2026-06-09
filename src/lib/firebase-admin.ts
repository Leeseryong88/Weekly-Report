import { readFileSync, existsSync } from "fs";
import path from "path";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { ServiceAccount } from "firebase-admin/app";
import type { UserRole } from "@/types";

function normalizeServiceAccount(raw: Record<string, unknown>): ServiceAccount {
  const privateKey =
    typeof raw.private_key === "string"
      ? raw.private_key.replace(/\\n/g, "\n")
      : typeof raw.privateKey === "string"
        ? raw.privateKey.replace(/\\n/g, "\n")
        : undefined;

  return {
    projectId: (raw.project_id ?? raw.projectId) as string,
    clientEmail: (raw.client_email ?? raw.clientEmail) as string,
    privateKey,
  };
}

function loadServiceAccount(): ServiceAccount | null {
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (keyPath) {
    const resolved = path.isAbsolute(keyPath) ? keyPath : path.join(process.cwd(), keyPath);
    if (existsSync(resolved)) {
      return normalizeServiceAccount(JSON.parse(readFileSync(resolved, "utf8")));
    }
  }

  const inlineKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (inlineKey) {
    try {
      return normalizeServiceAccount(JSON.parse(inlineKey));
    } catch {
      return null;
    }
  }

  return null;
}

let cachedApp: App | null = null;

function getStorageBucketName(): string | undefined {
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
  return bucket || undefined;
}

function getAdminApp(): App {
  const serviceAccount = loadServiceAccount();
  const storageBucket = getStorageBucketName();

  if (cachedApp) return cachedApp;
  if (getApps().length > 0) {
    cachedApp = getApps()[0];
    return cachedApp;
  }

  if (serviceAccount) {
    cachedApp = initializeApp({
      credential: cert(serviceAccount),
      ...(storageBucket ? { storageBucket } : {}),
    });
    return cachedApp;
  }

  cachedApp = initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    ...(storageBucket ? { storageBucket } : {}),
  });
  return cachedApp;
}

export function getAdminStorageBucket() {
  const bucketName = getStorageBucketName();
  if (!bucketName) {
    throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not configured");
  }
  return getStorage(getAdminApp()).bucket(bucketName);
}

export function isAdminSdkConfigured(): boolean {
  return loadServiceAccount() !== null;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

// 하위 호환 export
export const adminAuth = new Proxy({} as Auth, {
  get(_target, prop) {
    return Reflect.get(getAdminAuth(), prop, getAdminAuth());
  },
});

export const adminDb = new Proxy({} as Firestore, {
  get(_target, prop) {
    return Reflect.get(getAdminDb(), prop, getAdminDb());
  },
});

export type VerifyResult =
  | { ok: true; uid: string; role: UserRole }
  | {
      ok: false;
      reason: "no_token" | "invalid_token" | "no_profile" | "inactive" | "sdk_not_configured" | "server_error";
      detail?: string;
    };

export async function verifyAuthToken(authHeader: string | null): Promise<VerifyResult> {
  if (!isAdminSdkConfigured()) {
    return { ok: false, reason: "sdk_not_configured" };
  }

  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, reason: "no_token" };
  }

  const token = authHeader.slice(7);

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(token);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "token verify failed";
    return { ok: false, reason: "invalid_token", detail };
  }

  try {
    const userDoc = await getAdminDb().collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return { ok: false, reason: "no_profile" };
    const data = userDoc.data();
    if (!data?.isActive) return { ok: false, reason: "inactive" };
    return { ok: true, uid: decoded.uid, role: data.role as UserRole };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "firestore read failed";
    return { ok: false, reason: "server_error", detail };
  }
}

export function canUseAi(role: UserRole): boolean {
  return role === "team_leader" || role === "part_leader" || role === "admin";
}

function verifyErrorMessage(result: Extract<VerifyResult, { ok: false }>): string {
  switch (result.reason) {
    case "sdk_not_configured":
      return "FIREBASE_SERVICE_ACCOUNT_KEY(또는 FIREBASE_SERVICE_ACCOUNT_PATH)가 설정되지 않았습니다. .env.local 설정 후 dev 서버를 재시작하세요.";
    case "no_token":
      return "인증 토큰이 없습니다. 다시 로그인해주세요.";
    case "invalid_token":
      return `인증 토큰이 유효하지 않습니다. 로그아웃 후 다시 로그인해주세요.${result.detail ? ` (${result.detail})` : ""}`;
    case "no_profile":
      return "Firestore users 프로필이 없습니다.";
    case "inactive":
      return "비활성화된 계정입니다.";
    case "server_error":
      return `서버 Firebase 연결 오류입니다. dev 서버를 재시작해주세요.${result.detail ? ` (${result.detail})` : ""}`;
  }
}

export { verifyErrorMessage };
