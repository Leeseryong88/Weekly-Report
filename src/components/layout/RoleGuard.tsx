"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { UserRole } from "@/types";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { getDefaultReportPath } from "@/lib/week-key";

interface RoleGuardProps {
  allowed: UserRole[];
  children: React.ReactNode;
}

export function RoleGuard({ allowed, children }: RoleGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && !allowed.includes(user.role)) {
      router.replace(getDefaultReportPath(user.role));
    }
  }, [user, loading, allowed, router]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user || !allowed.includes(user.role)) return null;
  return <>{children}</>;
}
