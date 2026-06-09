"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/Button";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !firebaseUser) {
      router.replace("/login");
    }
  }, [firebaseUser, loading, router]);

  useEffect(() => {
    if (!loading && user?.mustChangePassword && pathname !== "/change-password") {
      router.replace("/change-password");
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!firebaseUser) return null;

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">계정 등록 필요</h2>
          <p className="mt-2 text-sm text-slate-500">
            로그인은 되었으나 사용자 프로필이 없습니다. 관리자에게 계정 생성을 요청하세요.
          </p>
          <Button variant="ghost" className="mt-4" onClick={() => signOut()}>
            로그아웃
          </Button>
        </div>
      </div>
    );
  }

  if (user.mustChangePassword && pathname !== "/change-password") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
