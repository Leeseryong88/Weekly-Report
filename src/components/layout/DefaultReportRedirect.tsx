"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { getDefaultReportPath } from "@/lib/week-key";

export function DefaultReportRedirect() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace(getDefaultReportPath(user.role));
    }
  }, [user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <LoadingSpinner size="lg" />
    </div>
  );
}
