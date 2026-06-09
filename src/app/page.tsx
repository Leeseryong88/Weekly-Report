"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { DefaultReportRedirect } from "@/components/layout/DefaultReportRedirect";

export default function HomePage() {
  return (
    <AuthProvider>
      <AuthGuard>
        <DefaultReportRedirect />
      </AuthGuard>
    </AuthProvider>
  );
}
