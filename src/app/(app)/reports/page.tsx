"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isSameWeek,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { CalendarCheck, PenLine } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/Card";
import { Input, Select, FormField } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SubmitStatusBadge, ProgressBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { WeeklyReportForm } from "@/components/reports/WeeklyReportForm";
import { ReportDetailView } from "@/components/reports/ReportDetailView";
import { listRecentWeekKeys, getCurrentWeekKey, getWeekKey, getWeekLabel } from "@/lib/week-key";
import {
  searchWeeklyReports,
  getAllTeams,
  getAllUsers,
  getUsersByTeam,
  getWeeklyReportsByUsers,
  getWeeklyReportsByUsersAndWeek,
  deleteWeeklyReport,
} from "@/lib/firestore/services";
import { cn } from "@/lib/utils";
import type { WeeklyReport, Team, User, ReportTaskStatus } from "@/types";

const CAN_WRITE_ROLES = ["member", "team_leader"];
const WEEKDAY_LABELS = ["토", "일", "월", "화", "수", "목", "금"];

function weekRangeLabel(weekKey: string) {
  const start = parseISO(weekKey);
  const end = addDays(start, 6);
  return `${format(start, "M/d")} - ${format(end, "M/d")}`;
}

function getReportTaskStatusCounts(report: WeeklyReport): Record<ReportTaskStatus, number> {
  const items = [
    ...(report.weeklyWorkItems ?? []),
    ...(report.thisWeekWorkItems ?? []),
    ...(report.nextWeekPlanItems ?? []),
    ...(report.requestItems ?? []),
    ...(report.specialNoteItems ?? []),
  ];

  return items.reduce<Record<ReportTaskStatus, number>>(
    (counts, item) => {
      if (item.content.trim()) counts[item.status] += 1;
      return counts;
    },
    { in_progress: 0, completed: 0, delayed: 0 }
  );
}

function TaskStatusCountBadges({ report }: { report: WeeklyReport }) {
  const counts = getReportTaskStatusCounts(report);
  return (
    <div className="flex flex-wrap gap-2">
      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
        진행중 {counts.in_progress}
      </span>
      <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
        완료 {counts.completed}
      </span>
      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        지연 {counts.delayed}
      </span>
    </div>
  );
}

function sortUsersByTeamHierarchy(users: User[], teams: Team[]) {
  const usersByTeam = new Map<string, User[]>();
  const usersWithoutTeam: User[] = [];

  users.forEach((user) => {
    if (!user.teamId) {
      usersWithoutTeam.push(user);
      return;
    }

    const teamUsers = usersByTeam.get(user.teamId) ?? [];
    teamUsers.push(user);
    usersByTeam.set(user.teamId, teamUsers);
  });

  const ordered: User[] = [];
  const seen = new Set<string>();
  const append = (user: User | undefined) => {
    if (!user || seen.has(user.id)) return;
    ordered.push(user);
    seen.add(user.id);
  };
  const byName = (a: User, b: User) => a.name.localeCompare(b.name, "ko");

  teams.forEach((team) => {
    const teamUsers = usersByTeam.get(team.id) ?? [];
    const leader =
      teamUsers.find((user) => user.id === team.leaderUserId) ??
      teamUsers.find((user) => user.role === "team_leader");

    append(leader);
    teamUsers
      .filter((user) => user.role === "member")
      .sort(byName)
      .forEach(append);
    teamUsers
      .filter((user) => user.role !== "team_leader" && user.role !== "member")
      .sort(byName)
      .forEach(append);
  });

  Array.from(usersByTeam.entries())
    .filter(([teamId]) => !teams.some((team) => team.id === teamId))
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([, teamUsers]) => {
      const leader = teamUsers.find((user) => user.role === "team_leader");
      append(leader);
      teamUsers
        .filter((user) => user.id !== leader?.id)
        .sort(byName)
        .forEach(append);
    });

  usersWithoutTeam
    .sort((a, b) => a.role.localeCompare(b.role) || byName(a, b))
    .forEach(append);

  return ordered;
}

function MemberWeekCalendar({
  reports,
  onSelectWeek,
}: {
  reports: WeeklyReport[];
  onSelectWeek: (weekKey: string, report: WeeklyReport | null) => void;
}) {
  const reportByWeek = new Map(reports.map((report) => [report.weekKey, report]));
  const currentWeekKey = getCurrentWeekKey();
  const currentWeekStart = parseISO(currentWeekKey);
  const [visibleMonth, setVisibleMonth] = useState(currentWeekStart);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 6 }),
    end: endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 6 }),
  });
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, index) =>
    days.slice(index * 7, index * 7 + 7)
  );

  const getStatus = (weekKey: string) => {
    const report = reportByWeek.get(weekKey);
    if (report?.submitStatus === "submitted") return "제출완료";
    if (report?.submitStatus === "draft") return "임시저장";
    if (weekKey === currentWeekKey) return "작성 주";
    return "미작성";
  };

  return (
    <Card
      title="주간보고 캘린더"
      className="h-fit"
    >
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-green-50 px-2 py-1 text-green-700">제출완료</span>
        <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">임시저장</span>
        <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">작성 주</span>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setVisibleMonth((month) => subMonths(month, 1))}
        >
          이전 달
        </Button>
        <p className="text-base font-semibold text-slate-900">{format(visibleMonth, "yyyy년 M월")}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
        >
          다음 달
        </Button>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="border-b border-slate-200 bg-slate-50 px-1 py-1.5 text-center text-[11px] font-semibold text-slate-500"
          >
            {label}
          </div>
        ))}

        {weeks.map((week) => {
          const weekStart = week[0];
          const weekKey = getWeekKey(weekStart);
          const report = reportByWeek.get(weekKey) ?? null;
          const submitted = report?.submitStatus === "submitted";
          const draft = report?.submitStatus === "draft";
          const isCurrentWeek = weekKey === currentWeekKey;
          const status = getStatus(weekKey);
          const isHoveredWeek = hoveredDate
            ? isSameWeek(weekStart, hoveredDate, { weekStartsOn: 6 })
            : false;

          return (
            <div key={weekKey} className="relative col-span-7 grid grid-cols-7">
              <div
                className={cn(
                  "pointer-events-none absolute left-1 right-1 top-8 z-10 flex h-6 items-center justify-center rounded-full text-xs font-semibold shadow-sm",
                  submitted && "bg-green-100 text-green-700",
                  draft && "bg-amber-100 text-amber-700",
                  isCurrentWeek && !submitted && !draft && "bg-blue-100 text-blue-700",
                  !submitted && !draft && !isCurrentWeek && "bg-slate-100 text-slate-500"
                )}
              >
                {status}
              </div>

              {week.map((day) => {
                const dayWeekKey = getWeekKey(day);
                const dayReport = reportByWeek.get(dayWeekKey) ?? null;

                return (
                  <button
                    key={format(day, "yyyy-MM-dd")}
                    type="button"
                    onMouseEnter={() => setHoveredDate(day)}
                    onFocus={() => setHoveredDate(day)}
                    onClick={() => onSelectWeek(dayWeekKey, dayReport)}
                    className={cn(
                      "relative min-h-16 border-b border-r border-slate-200 p-1 text-left transition-colors",
                      !isSameMonth(day, visibleMonth) && "bg-slate-50 text-slate-300",
                      isSameMonth(day, visibleMonth) && "bg-white text-slate-700",
                      isHoveredWeek && "bg-slate-100",
                      submitted && "bg-green-50 hover:bg-green-100",
                      draft && "bg-amber-50 hover:bg-amber-100",
                      isCurrentWeek &&
                        !submitted &&
                        !draft &&
                        "bg-blue-50 hover:bg-blue-100"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold leading-none",
                        isSameDay(day, new Date()) ? "bg-blue-600 text-white" : "text-slate-700"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TeamMemberReportOverview({
  members,
  reports,
  weekKeys,
  onSelectReport,
}: {
  members: User[];
  reports: WeeklyReport[];
  weekKeys: string[];
  onSelectReport: (report: WeeklyReport) => void;
}) {
  const displayWeeks = weekKeys.slice(0, 12);
  const reportsByMember = new Map<string, WeeklyReport[]>();
  members.forEach((member) => reportsByMember.set(member.id, []));
  reports.forEach((report) => {
    const items = reportsByMember.get(report.userId);
    if (items) items.push(report);
  });

  members.forEach((member) => {
    reportsByMember.get(member.id)?.sort((a, b) => b.weekKey.localeCompare(a.weekKey));
  });

  return (
    <div className="space-y-3">
      {members.map((member) => {
        const memberReports = reportsByMember.get(member.id) ?? [];
        const reportByWeek = new Map(memberReports.map((report) => [report.weekKey, report]));
        const latestReport = memberReports[0];
        const submittedCount = memberReports.filter(
          (report) => report.submitStatus === "submitted"
        ).length;

        return (
          <div
            key={member.id}
            className="rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-blue-200"
          >
            <div className="grid gap-3 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                  {member.name.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate font-semibold text-slate-900">{member.name}</p>
                    {member.role === "team_leader" && (
                      <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                        팀장
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    제출 {submittedCount}건
                    {latestReport ? ` · 최근 ${weekRangeLabel(latestReport.weekKey)}` : ""}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-6 gap-1.5 md:grid-cols-12">
                {displayWeeks.map((targetWeekKey) => {
                  const report = reportByWeek.get(targetWeekKey);
                  const submitted = report?.submitStatus === "submitted";
                  const draft = report?.submitStatus === "draft";

                  return (
                    <button
                      key={`${member.id}-${targetWeekKey}`}
                      type="button"
                      disabled={!report}
                      onClick={() => report && onSelectReport(report)}
                      title={`${weekRangeLabel(targetWeekKey)} ${report ? "보고서 보기" : "미작성"}`}
                      className={cn(
                        "h-8 rounded-md border text-[11px] font-semibold transition-colors",
                        submitted && "border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
                        draft && "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
                        !report && "border-slate-100 bg-slate-50 text-slate-300"
                      )}
                    >
                      {format(parseISO(targetWeekKey), "M/d")}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {members.length === 0 && (
        <EmptyState title="팀원이 없습니다" description="팀에 등록된 팀원이 없습니다." />
      )}
    </div>
  );
}

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const weekKeys = listRecentWeekKeys(16);
  const currentWeekKey = getCurrentWeekKey();

  const [weekKey, setWeekKey] = useState("");
  const [teamId, setTeamId] = useState("");
  const [userId, setUserId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [writeOpen, setWriteOpen] = useState(false);
  const [writeWeekKey, setWriteWeekKey] = useState(currentWeekKey);
  const [editReport, setEditReport] = useState<WeeklyReport | null>(null);
  const [detailReport, setDetailReport] = useState<WeeklyReport | null>(null);
  const [historyPage, setHistoryPage] = useState(1);

  const canWrite = user ? CAN_WRITE_ROLES.includes(user.role) : false;
  const isMember = user?.role === "member";
  const isTeamLeader = user?.role === "team_leader";

  const loadReports = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let effectiveWeekKey = weekKey || undefined;
      let effectiveTeamId = teamId || undefined;
      let effectiveUserId = userId || undefined;

      if (user.role === "member") {
        effectiveWeekKey = undefined;
        effectiveTeamId = undefined;
        effectiveUserId = user.id;
      } else if (user.role === "team_leader") {
        const teamMembers = user.teamId ? await getUsersByTeam(user.teamId) : [];
        const currentMemberIds = teamMembers
          .filter((member) => member.role === "member")
          .map((member) => member.id);
        const targetUserIds = userId ? [userId] : [user.id, ...currentMemberIds];
        const data = effectiveWeekKey
          ? await getWeeklyReportsByUsersAndWeek(targetUserIds, effectiveWeekKey)
          : await getWeeklyReportsByUsers(targetUserIds);
        const sorted = data.sort((a, b) => b.weekKey.localeCompare(a.weekKey));
        setReports(sorted);
        return;
      } else if (user.role === "part_leader") {
        const allUsers = await getAllUsers();
        const subordinateUserIds = allUsers
          .filter(
            (item) =>
              (item.role === "team_leader" || item.role === "member") &&
              (!effectiveTeamId || item.teamId === effectiveTeamId) &&
              (!effectiveUserId || item.id === effectiveUserId)
          )
          .map((item) => item.id);
        const data = effectiveWeekKey
          ? await getWeeklyReportsByUsersAndWeek(subordinateUserIds, effectiveWeekKey)
          : await getWeeklyReportsByUsers(subordinateUserIds);
        const sorted = data.sort((a, b) => b.weekKey.localeCompare(a.weekKey));
        setReports(sorted);
        return;
      }

      const data = await searchWeeklyReports(effectiveWeekKey, effectiveTeamId, effectiveUserId);
      const sorted = data.sort((a, b) => b.weekKey.localeCompare(a.weekKey));
      setReports(sorted);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [user, weekKey, teamId, userId]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const allTeams = await getAllTeams();
        const visibleTeams =
          user.role === "admin" || user.role === "part_leader"
            ? allTeams
            : allTeams.filter((team) => team.id === user.teamId);
        setTeams(visibleTeams);

        if (user.role === "admin") {
          setUsers(await getAllUsers());
        } else if (user.role === "part_leader") {
          const allUsers = await getAllUsers();
          setUsers(allUsers.filter((item) => item.role === "team_leader" || item.role === "member"));
        } else if (user.role === "team_leader" && user.teamId) {
          setUsers(await getUsersByTeam(user.teamId));
        } else {
          setUsers([user]);
        }
      } catch {
        setTeams([]);
        setUsers([user]);
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadReports();
  }, [user, loadReports]);

  useEffect(() => {
    setHistoryPage(1);
  }, [keyword]);

  const filtered = keyword
    ? reports.filter(
        (report) =>
          report.thisWeekWork.includes(keyword) ||
          report.nextWeekPlan.includes(keyword) ||
          report.requests.includes(keyword) ||
          report.specialNotes.includes(keyword)
      )
    : reports;
  const historyPageSize = 5;
  const historyPageCount = Math.max(1, Math.ceil(filtered.length / historyPageSize));
  const pagedHistory = filtered.slice(
    (historyPage - 1) * historyPageSize,
    historyPage * historyPageSize
  );

  useEffect(() => {
    if (historyPage > historyPageCount) setHistoryPage(historyPageCount);
  }, [historyPage, historyPageCount]);

  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t.name]));
  const overviewUsers =
    user?.role === "team_leader"
      ? sortUsersByTeamHierarchy(
          users.filter(
            (u) =>
              (u.role === "team_leader" || u.role === "member") &&
              u.teamId === user.teamId &&
              (!userId || u.id === userId)
          ),
          teams
        )
      : sortUsersByTeamHierarchy(
          users.filter(
            (u) =>
              (u.role === "team_leader" || u.role === "member") &&
              (!teamId || u.teamId === teamId) &&
              (!userId || u.id === userId)
          ),
          teams
        );

  const openWriteModal = (targetWeekKey = currentWeekKey, report: WeeklyReport | null = null) => {
    setWriteWeekKey(targetWeekKey);
    setEditReport(report);
    setWriteOpen(true);
  };

  const handleMemberWeekSelect = (targetWeekKey: string, report: WeeklyReport | null) => {
    if (!report || report.submitStatus === "draft") {
      openWriteModal(targetWeekKey, report);
      return;
    }
    setDetailReport(report);
  };

  const handleSaved = () => {
    loadReports();
  };

  const handleEditFromDetail = () => {
    if (!detailReport) return;
    openWriteModal(detailReport.weekKey, detailReport);
    setDetailReport(null);
  };

  const handleDeleteReport = async () => {
    if (!detailReport) return;
    await deleteWeeklyReport(detailReport.id, detailReport.fileUrls);
    setDetailReport(null);
    await loadReports();
  };

  const canManageOwnReport = detailReport && user && detailReport.userId === user.id;

  const canFilterTeam = user?.role === "admin" || user?.role === "part_leader";
  const canFilterAuthor =
    user?.role === "admin" || user?.role === "part_leader" || user?.role === "team_leader";

  if (authLoading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="[&>h2:first-child]:hidden">
          <h2 className="text-2xl font-bold text-slate-900">주간보고</h2>
          <h2 className="text-2xl font-bold text-slate-900">보고서</h2>
          <p className="text-slate-500">
            {isMember
              ? "주간보고 작성, 제출 여부 확인, 지난 보고 열람을 한 화면에서 처리합니다."
              : "보고서를 작성하고 검색할 수 있습니다."}
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => openWriteModal(currentWeekKey)}>
            <PenLine className="h-4 w-4" />
            주간보고 작성
          </Button>
        )}
      </div>

      {isMember && (
        <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <MemberWeekCalendar reports={reports} onSelectWeek={handleMemberWeekSelect} />

          <Card
            title="지난 주간보고"
            action={
              <div className="w-64">
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="내용 검색"
                />
              </div>
            }
          >
            {loading ? (
              <LoadingSpinner />
            ) : filtered.length === 0 ? (
              <EmptyState
                title="보고서가 없습니다"
                description="캘린더에서 원하는 주간을 선택해 작성하세요."
              />
            ) : (
              <div className="space-y-3">
                {pagedHistory.map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => setDetailReport(report)}
                    className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/30"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <CalendarCheck className="h-4 w-4 text-slate-400" />
                      <span className="font-medium text-slate-900">
                        {getWeekLabel(report.weekKey)}
                      </span>
                      <SubmitStatusBadge status={report.submitStatus} />
                    </div>
                    <TaskStatusCountBadges report={report} />
                  </button>
                ))}
                {historyPageCount > 1 && (
                  <div className="flex flex-wrap justify-end gap-1 pt-2">
                    {Array.from({ length: historyPageCount }, (_, index) => index + 1).map(
                      (page) => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setHistoryPage(page)}
                          className={cn(
                            "h-8 min-w-8 rounded border px-2 text-sm font-medium",
                            page === historyPage
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          {page}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {!isMember && !isTeamLeader && (
        <Card>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label="주차">
              <Select value={weekKey} onChange={(e) => setWeekKey(e.target.value)}>
                <option value="">전체</option>
                {weekKeys.map((k) => (
                  <option key={k} value={k}>
                    {getWeekLabel(k)}
                    {k === currentWeekKey ? " (이번 주)" : ""}
                  </option>
                ))}
              </Select>
            </FormField>
            {canFilterTeam && (
              <FormField label="팀">
                <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                  <option value="">전체</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
            {canFilterAuthor && (
              <FormField label="작성자">
                <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
                  <option value="">전체</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
            <FormField label="키워드">
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="검색어 입력"
              />
            </FormField>
          </div>
        </Card>
      )}

      {!isMember && (
        <Card
          title={isTeamLeader ? "팀원별 보고서 기록" : "사용자별 보고서 기록"}
          action={
            isTeamLeader ? (
              <div className="w-64">
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="내용 검색"
                />
              </div>
            ) : undefined
          }
        >
          {loading ? (
            <LoadingSpinner />
          ) : (
            <TeamMemberReportOverview
              members={overviewUsers}
              reports={filtered}
              weekKeys={weekKeys}
              onSelectReport={setDetailReport}
            />
          )}
        </Card>
      )}

      {false && !isMember && !isTeamLeader && (
        <>
          {loading ? (
            <LoadingSpinner />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="보고서가 없습니다"
              description={canWrite ? "주간보고 작성 버튼을 눌러 첫 보고서를 작성하세요." : undefined}
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => setDetailReport(report)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/30"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">
                      {userMap[report.userId] ?? report.userId}
                    </span>
                    <span className="text-sm text-slate-400">{teamMap[report.teamId]}</span>
                    <span className="text-sm text-slate-400">{getWeekLabel(report.weekKey)}</span>
                    <SubmitStatusBadge status={report.submitStatus} />
                    <ProgressBadge status={report.status} />
                  </div>
                  <p className="line-clamp-3 whitespace-pre-wrap text-sm text-slate-600">
                    {report.thisWeekWork}
                  </p>
                  {report.requests && (
                    <p className="mt-2 line-clamp-1 text-sm text-blue-600">요청: {report.requests}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <Modal
        open={writeOpen}
        onClose={() => {
          setWriteOpen(false);
          setEditReport(null);
        }}
        title={editReport ? "주간보고 수정" : "주간보고 작성"}
        size="full"
        bodyClassName="flex overflow-hidden p-0"
      >
        <WeeklyReportForm
          key={editReport?.id ?? `new-${writeWeekKey}`}
          initialWeekKey={editReport?.weekKey ?? writeWeekKey}
          initialReport={editReport}
          lockWeek={!!editReport}
          onSaved={(saved) => {
            handleSaved();
            if (saved.submitStatus === "submitted") {
              setWriteOpen(false);
              setEditReport(null);
            }
          }}
          onCancel={() => {
            setWriteOpen(false);
            setEditReport(null);
          }}
          showHeader
        />
      </Modal>

      <Modal open={!!detailReport} onClose={() => setDetailReport(null)} title="보고서 상세" size="xl">
        {detailReport && (
          <ReportDetailView
            report={detailReport}
            authorName={userMap[detailReport.userId] ?? detailReport.userId}
            teamName={teamMap[detailReport.teamId] ?? detailReport.teamId}
            canManage={!!canManageOwnReport}
            onEdit={canManageOwnReport ? handleEditFromDetail : undefined}
            onDelete={canManageOwnReport ? handleDeleteReport : undefined}
          />
        )}
      </Modal>
    </div>
  );
}
