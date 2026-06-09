"use client";

import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase";

export async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export function useAiSummary() {
  const { firebaseUser } = useAuth();

  const callAi = async (type: string, payload: unknown): Promise<string> => {
    if (!firebaseUser) throw new Error("로그인이 필요합니다.");
    const token = await firebaseUser.getIdToken();
    const res = await fetch("/api/ai/summary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ type, payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "AI 요약 생성 실패");
    return data.result as string;
  };

  return { callAi };
}
