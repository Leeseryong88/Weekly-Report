"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { getAppNavItems, isActiveNavItem } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/types";
import type { User } from "@/types";

function TopNavigation({
  user,
  pathname,
  onSignOut,
}: {
  user: User;
  pathname: string;
  onSignOut: () => void;
}) {
  const navItems = getAppNavItems(user.role);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="flex min-h-14 w-full items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="min-w-0 shrink-0">
          <p className="text-sm font-bold text-slate-900">주간보고</p>
          <p className="hidden text-xs text-slate-500 sm:block">
            {user.name} · {ROLE_LABELS[user.role]}
          </p>
        </div>

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActiveNavItem(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                  active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <Button variant="ghost" size="sm" className="shrink-0" onClick={onSignOut}>
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">로그아웃</span>
        </Button>
      </div>
    </header>
  );
}

function AppShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const isChangePassword = pathname === "/change-password";
  const showAdminSidebar = !isChangePassword && user?.role === "admin";
  const showTopNavigation = !isChangePassword && user && user.role !== "admin";

  return (
    <div className="flex min-h-screen bg-slate-50">
      {showAdminSidebar && <Sidebar />}
      <main className="min-w-0 flex-1 overflow-auto">
        {showTopNavigation && (
          <TopNavigation user={user} pathname={pathname} onSignOut={() => signOut()} />
        )}
        <div
          className={
            isChangePassword
              ? "mx-auto flex min-h-screen max-w-md items-center px-4 py-8"
              : showAdminSidebar
                ? "mx-auto max-w-7xl px-4 py-6 pt-16 lg:px-8 lg:py-8 lg:pt-8"
                : "w-full max-w-none px-4 py-4 sm:px-6 lg:px-8"
          }
        >
          {children}
        </div>
      </main>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>
        <AppShellContent>{children}</AppShellContent>
      </AuthGuard>
    </AuthProvider>
  );
}
