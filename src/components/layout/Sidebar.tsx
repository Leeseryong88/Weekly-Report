"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/types";
import { getAppNavItems, isActiveNavItem, type AppNavItem } from "@/components/layout/nav-items";
import type { User } from "@/types";

function SidebarNavContent({
  user,
  pathname,
  navItems,
  onNavigate,
  onSignOut,
}: {
  user: User;
  pathname: string;
  navItems: AppNavItem[];
  onNavigate: () => void;
  onSignOut: () => void;
}) {
  return (
    <>
      <div className="border-b border-slate-200 px-4 py-5">
        <h1 className="text-lg font-bold text-slate-900">주간보고</h1>
        <p className="mt-1 text-xs text-slate-500">{user.name}</p>
        <p className="text-xs text-blue-600">{ROLE_LABELS[user.role]}</p>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActiveNavItem(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-3">
        <Button variant="ghost" className="w-full justify-start" onClick={onSignOut}>
          <LogOut className="h-4 w-4" />
          로그아웃
        </Button>
      </div>
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user || user.role !== "admin") return null;

  const navItems = getAppNavItems(user.role);

  return (
    <>
      <button
        className="fixed left-4 top-4 z-40 rounded-lg border border-slate-200 bg-white p-2 lg:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </button>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-72 flex-col bg-white shadow-xl">
            <button
              className="absolute right-3 top-3 rounded p-1"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarNavContent
              user={user}
              pathname={pathname}
              navItems={navItems}
              onNavigate={() => setMobileOpen(false)}
              onSignOut={() => signOut()}
            />
          </aside>
        </div>
      )}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <SidebarNavContent
          user={user}
          pathname={pathname}
          navItems={navItems}
          onNavigate={() => setMobileOpen(false)}
          onSignOut={() => signOut()}
        />
      </aside>
    </>
  );
}
