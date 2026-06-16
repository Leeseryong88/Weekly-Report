"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addDays,
  format,
  parseISO,
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
import { listRecentWeekKeys, getCurrentWeekKey, getWeekLabel } from "@/lib/week-key";
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

const CAN_WRITE_ROLES = ["team_leader"];

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
    ...(report.deptHeadDirectiveItems ?? []),
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
      <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
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
  const [writeFormKey, setWriteFormKey] = useState<string | null>(null);
  const [editReport, setEditReport] = useState<WeeklyReport | null>(null);
  const [detailReport, setDetailReport] = useState<WeeklyReport | null>(null);
  const [historyPage, setHistoryPage] = useState(1);

  const canWrite = user ? CAN_WRITE_ROLES.includes(user.role) : false;
  const isMember = user?.role === "member";
  const isTeamLeader = user?.role === "team_leader";

  const loadReports = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) return;
    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);
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
      } else if (user.role === "admin" || user.role === "part_leader") {
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
      if (!silent) setLoading(false);
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
    queueMicrotask(() => {
      void loadReports();
    });
  }, [user, loadReports]);

  const filtered = keyword
    ? reports.filter(
        (report) =>
          report.thisWeekWork.includes(keyword) ||
          report.nextWeekPlan.includes(keyword) ||
          report.requests.includes(keyword) ||
          report.deptHeadDirectives.includes(keyword) ||
          report.specialNotes.includes(keyword)
      )
    : reports;
  const historyPageSize = 5;
  const historyPageCount = Math.max(1, Math.ceil(filtered.length / historyPageSize));
  const boundedHistoryPage = Math.min(historyPage, historyPageCount);
  const pagedHistory = filtered.slice(
    (boundedHistoryPage - 1) * historyPageSize,
    boundedHistoryPage * historyPageSize
  );

  const handleKeywordChange = (value: string) => {
    setKeyword(value);
    setHistoryPage(1);
  };

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
    setWriteFormKey(report?.id ?? `new-${targetWeekKey}-${Date.now()}`);
    setWriteOpen(true);
  };

  const closeWriteModal = () => {
    setWriteOpen(false);
    setEditReport(null);
    setWriteFormKey(null);
  };

  const handleSaved = () => {
    loadReports({ silent: true });
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

  const canManageOwnReport =
    detailReport && user && detailReport.userId === user.id && user.role !== "member";

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
              ? "본인이 작성한 보고서를 검색하고 확인합니다."
              : "보고서를 작성하고 검색할 수 있습니다."}
          </p>
        </div>
        {canWrite && !isMember && (
          <Button onClick={() => openWriteModal(currentWeekKey)}>
            <PenLine className="h-4 w-4" />
            주간보고 작성
          </Button>
        )}
      </div>

      {isMember && (
        <Card
          title="내 보고서"
          action={
            <div className="w-64">
              <Input
                value={keyword}
                onChange={(e) => handleKeywordChange(e.target.value)}
                placeholder="내용 검색"
              />
            </div>
          }
        >
          {loading ? (
            <LoadingSpinner />
          ) : filtered.length === 0 ? (
            <EmptyState title="보고서가 없습니다" description="작성한 보고서가 없습니다." />
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
                          page === boundedHistoryPage
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
                onChange={(e) => handleKeywordChange(e.target.value)}
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
                  onChange={(e) => handleKeywordChange(e.target.value)}
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
        onClose={closeWriteModal}
        title={editReport ? "주간보고 수정" : "주간보고 작성"}
        size="full"
        bodyClassName="flex overflow-hidden p-0"
      >
        {writeFormKey && (
          <WeeklyReportForm
            key={writeFormKey}
            initialWeekKey={editReport?.weekKey ?? writeWeekKey}
            initialReport={editReport}
            lockWeek={!!editReport}
            onSaved={(saved) => {
              setEditReport(saved);
              handleSaved();
            }}
            onCancel={closeWriteModal}
            showHeader
          />
        )}
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
