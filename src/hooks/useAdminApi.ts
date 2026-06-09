"use client";

import { useAuth } from "@/contexts/AuthContext";

export function useAdminApi() {
  const { firebaseUser } = useAuth();

  const callAdminApi = async <T>(
    path: string,
    body: unknown,
    method: "POST" | "PATCH" = "POST"
  ): Promise<T> => {
    if (!firebaseUser) throw new Error("로그인이 필요합니다.");
    const token = await firebaseUser.getIdToken();
    const res = await fetch(path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "요청 실패");
    return data as T;
  };

  return { callAdminApi };
}
