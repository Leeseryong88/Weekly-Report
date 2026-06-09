import { Building2, ClipboardList, FileEdit, Users, type LucideIcon } from "lucide-react";
import { getCurrentWeekKey } from "@/lib/week-key";
import type { UserRole } from "@/types";

export interface AppNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
}

export function getAppNavItems(role: UserRole): AppNavItem[] {
  const weekKey = getCurrentWeekKey();

  const items: AppNavItem[] = [
    {
      href: `/reports/team/${weekKey}`,
      label: "팀 주간보고",
      icon: ClipboardList,
      roles: ["team_leader", "admin"],
    },
    {
      href: `/reports/part/${weekKey}`,
      label: "파트 주간보고",
      icon: ClipboardList,
      roles: ["part_leader", "admin"],
    },
    {
      href: "/reports",
      label: "보고서(필터,검색)",
      icon: FileEdit,
      roles: ["admin", "part_leader", "team_leader", "member"],
    },
    { href: "/admin/users", label: "사용자 관리", icon: Users, roles: ["admin"] },
    { href: "/admin/teams", label: "팀 관리", icon: Building2, roles: ["admin"] },
  ];

  return items.filter((item) => item.roles.includes(role));
}

export function isActiveNavItem(pathname: string, href: string) {
  return href === "/reports"
    ? pathname === "/reports"
    : pathname === href || pathname.startsWith(`${href}/`);
}
