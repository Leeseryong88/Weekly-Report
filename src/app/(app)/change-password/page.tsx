"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePassword } from "firebase/auth";
import { useAuth } from "@/contexts/AuthContext";
import { clearMustChangePassword } from "@/lib/firestore/services";
import { Button } from "@/components/ui/Button";
import { Input, FormField } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { getDefaultReportPath } from "@/lib/week-key";

export default function ChangePasswordPage() {
  const { user, firebaseUser, loading, refreshUser } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user || !firebaseUser) return null;

  if (!user.mustChangePassword) {
    router.replace(getDefaultReportPath(user.role));
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(firebaseUser, password);
      await clearMustChangePassword(user.id);
      await refreshUser();
      router.replace(getDefaultReportPath(user.role));
    } catch {
      setError("비밀번호 변경에 실패했습니다. 다시 로그인 후 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">비밀번호 변경</h2>
        <p className="mt-1 text-sm text-slate-500">
          보안을 위해 최초 로그인 시 새 비밀번호를 설정해야 합니다.
        </p>
      </div>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="새 비밀번호" htmlFor="password">
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </FormField>
          <FormField label="새 비밀번호 확인" htmlFor="passwordConfirm">
            <Input
              id="passwordConfirm"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              minLength={6}
              required
            />
          </FormField>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "변경 중..." : "비밀번호 변경"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
