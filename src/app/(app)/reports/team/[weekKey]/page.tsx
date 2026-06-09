"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
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
import { Check, ChevronLeft, ChevronRight, PenLine, RefreshCw } from "lucide-react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Modal } from "@/components/ui/Modal";
import { WeeklyReportPreviewCard } from "@/components/reports/WeeklyReportPreviewCard";
import { WeeklyReportForm } from "@/components/reports/WeeklyReportForm";
import { useAuth } from "@/contexts/AuthContext";
import { getTeam, getUsersByTeam, getWeeklyReportsByUsersAndWeek } from "@/lib/firestore/services";
import { cn } from "@/lib/utils";
import { getWeekKey } from "@/lib/week-key";
import type { Team, User, WeeklyReport } from "@/types";

const WEEKDAY_LABELS = ["토", "일", "월", "화", "수", "목", "금"];

function getMonthWeekKeys(month: Date) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 6 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 6 }),
  });
  const keys = new Set<string>();
  days.forEach((day) => keys.add(getWeekKey(day)));
  return { days, weekKeys: Array.from(keys) };
}

function TeamSubmissionCalendar({
  visibleMonth,
  selectedWeekKey,
  members,
  submitterCount,
  reportsByWeek,
  onSelectWeek,
  onMonthChange,
}: {
  visibleMonth: Date;
  selectedWeekKey: string;
  members: User[];
  submitterCount: number;
  reportsByWeek: Map<string, WeeklyReport[]>;
  onSelectWeek: (weekKey: string) => void;
  onMonthChange: (month: Date) => void;
}) {
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const { days } = useMemo(() => getMonthWeekKeys(visibleMonth), [visibleMonth]);
  const selectedWeekStart = parseISO(selectedWeekKey);
  const selectedReports = reportsByWeek.get(selectedWeekKey) ?? [];
  const submittedCount = selectedReports.length;
  const totalCount = submitterCount;
  const completed = totalCount > 0 && submittedCount === totalCount;
  const today = new Date();

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(subMonths(visibleMonth, 1))}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label="이전 달"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-slate-900">{format(visibleMonth, "yyyy년 M월")}</p>
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(visibleMonth, 1))}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label="다음 달"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-slate-500">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="py-1">
            {label}
          </span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-0.5" onMouseLeave={() => setHoveredDate(null)}>
        {days.map((day) => {
          const dayWeekKey = getWeekKey(day);
          const inCurrentMonth = isSameMonth(day, visibleMonth);
          const isHoveredWeek = hoveredDate
            ? isSameWeek(day, hoveredDate, { weekStartsOn: 6 })
            : false;
          const isSelectedWeek = isSameWeek(day, selectedWeekStart, { weekStartsOn: 6 });
          const isWeekStart = day.getDay() === 6;
          const isWeekEnd = day.getDay() === 5;

          return (
            <button
              key={format(day, "yyyy-MM-dd")}
              type="button"
              onMouseEnter={() => setHoveredDate(day)}
              onFocus={() => setHoveredDate(day)}
              onClick={() => onSelectWeek(dayWeekKey)}
              className={cn(
                "h-8 text-xs transition-colors",
                isWeekStart && "rounded-l-full",
                isWeekEnd && "rounded-r-full",
                !inCurrentMonth && "text-slate-300",
                inCurrentMonth && "text-slate-700",
                isHoveredWeek && !isSelectedWeek && "bg-slate-200",
                isSelectedWeek && "bg-blue-100 font-semibold text-blue-800",
                isSameDay(day, selectedWeekStart) && "rounded-l-full",
                isSameDay(day, addDays(selectedWeekStart, 6)) &&
                  "rounded-r-full bg-blue-600 text-white",
                isSameDay(day, today) && !isSelectedWeek && "font-semibold text-blue-600"
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "mt-3 rounded-lg px-3 py-2 text-sm font-semibold",
          completed && "bg-green-50 text-green-700",
          !completed && submittedCount > 0 && "bg-amber-50 text-amber-700",
          submittedCount === 0 && "bg-slate-50 text-slate-500"
        )}
      >
        {format(selectedWeekStart, "M/d")} - {format(addDays(selectedWeekStart, 6), "M/d")} ·{" "}
        {submittedCount}/{totalCount} 제출
      </div>
    </div>
  );
}

function TeamOrgChart({
  team,
  teamId,
  leaderId,
  leaderName,
  leaderReport,
  members,
  selectedReports,
  selectedMembers,
  onToggleLeader,
  onToggleMember,
  onRefresh,
  refreshing,
}: {
  team: Team | null;
  teamId: string;
  leaderId: string | null;
  leaderName: string;
  leaderReport: WeeklyReport | null;
  members: User[];
  selectedReports: WeeklyReport[];
  selectedMembers: Set<string>;
  onToggleLeader: () => void;
  onToggleMember: (memberId: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="relative flex min-h-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-4 pb-4 pt-12 sm:pt-4">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onRefresh}
        disabled={refreshing}
        className="absolute right-3 top-3 h-8 px-2.5"
        title="보고서 최신화"
      >
        <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        <span className="hidden sm:inline">{refreshing ? "새로고침 중" : "새로고침"}</span>
      </Button>
      <div className="flex w-full max-w-5xl flex-col items-center">
        <button
          type="button"
          onClick={onToggleLeader}
          disabled={!leaderId}
          className={cn(
            "inline-flex max-w-full items-center gap-2 rounded-full border bg-white px-3 py-2 text-sm shadow-sm transition-colors [&>p]:hidden [&>span:nth-of-type(5)]:hidden [&>span:nth-of-type(6)]:hidden",
            leaderId && selectedMembers.has(leaderId)
              ? "border-blue-300 bg-blue-50 ring-2 ring-blue-100"
              : "border-blue-200 hover:border-blue-300 hover:bg-white",
            !leaderId && "cursor-default opacity-70"
          )}
        >
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
              leaderReport
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-slate-200 bg-slate-50 text-slate-300"
            )}
            aria-hidden="true"
          >
            {leaderReport && <Check className="h-4 w-4" />}
          </span>
          <span className="min-w-0 truncate font-semibold text-blue-700">
            {team?.name ?? teamId}
          </span>
          <span className="h-4 w-px shrink-0 bg-slate-200" />
          <span className="shrink-0 font-semibold text-slate-900">팀장({leaderName})</span>
          <span className="shrink-0 font-semibold text-slate-900">팀장({leaderName})</span>
          <span className="shrink-0 font-semibold text-slate-900">팀장({leaderName})</span>
          <p className="mt-1 text-base font-bold text-slate-900">팀장({leaderName})</p>
        </button>

        {members.length > 0 && (
          <>
            <div className="h-4 w-px bg-slate-300" />
          </>
        )}
        <div
          className={cn(
            "mx-auto flex w-full max-w-5xl flex-wrap justify-center gap-1.5 rounded-lg border border-slate-200 bg-white/70 p-2.5",
            members.length > 0 && "mt-0"
          )}
        >
          {members.map((member) => {
            const report = selectedReports.find((item) => item.userId === member.id);
            const selected = selectedMembers.has(member.id);

            return (
              <button
                key={member.id}
                type="button"
                onClick={() => onToggleMember(member.id)}
                className={cn(
                  "inline-flex h-7 max-w-32 items-center rounded-full border bg-white px-2 text-xs transition-colors",
                  selected
                    ? "border-blue-300 bg-blue-50 ring-2 ring-blue-100"
                    : "border-slate-200 hover:border-blue-200 hover:bg-white"
                )}
              >
                <span
                  className={cn(
                    "mr-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                    report
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-slate-200 bg-slate-50 text-slate-300"
                  )}
                  aria-hidden="true"
                >
                  {report && <Check className="h-3 w-3" />}
                </span>
                <span className="min-w-0 truncate font-semibold text-slate-900">{member.name}</span>
              </button>
            );
          })}

          {members.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
              등록된 팀원이 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TeamConsolidateContent() {
  const { user } = useAuth();
  const params = useParams();
  const initialWeekKey = params.weekKey as string;

  const [visibleMonth, setVisibleMonth] = useState(() => parseISO(initialWeekKey));
  const [selectedWeekKey, setSelectedWeekKey] = useState(initialWeekKey);
  const [team, setTeam] = useState<Team | null>(null);
  const [teamLeader, setTeamLeader] = useState<User | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [reportsByWeek, setReportsByWeek] = useState<Map<string, WeeklyReport[]>>(new Map());
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [writeOpen, setWriteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!user?.teamId) {
      setLoading(false);
      return;
    }

    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const { weekKeys } = getMonthWeekKeys(visibleMonth);
      const [teamMembers, teamData] = await Promise.all([
        getUsersByTeam(user.teamId),
        getTeam(user.teamId),
      ]);
      const memberList = teamMembers.filter((member) => member.role === "member");
      const leader =
        teamMembers.find((member) => member.id === teamData?.leaderUserId) ??
        teamMembers.find((member) => member.role === "team_leader") ??
        (user.role === "team_leader" ? user : null);
      const memberIds = memberList.map((member) => member.id);
      const reportUserIds = leader ? Array.from(new Set([leader.id, ...memberIds])) : memberIds;
      const weeklyReportGroups = await Promise.all(
        weekKeys.map((targetWeekKey) =>
          getWeeklyReportsByUsersAndWeek(reportUserIds, targetWeekKey)
        )
      );
      const nextReportsByWeek = new Map<string, WeeklyReport[]>();
      weekKeys.forEach((targetWeekKey, index) => {
        nextReportsByWeek.set(
          targetWeekKey,
          weeklyReportGroups[index].filter((report) => report.submitStatus === "submitted")
        );
      });

      setTeam(teamData);
      setTeamLeader(leader);
      setMembers(memberList);
      setReportsByWeek(nextReportsByWeek);
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [user, visibleMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <LoadingSpinner size="lg" />;
  if (!user?.teamId) return <p className="text-slate-500">소속 팀이 없습니다.</p>;

  const selectedReports = reportsByWeek.get(selectedWeekKey) ?? [];
  const reportUsers = teamLeader
    ? [teamLeader, ...members.filter((member) => member.id !== teamLeader.id)]
    : members;
  const memberNames = Object.fromEntries(reportUsers.map((member) => [member.id, member.name]));
  const selectedReportsByMember = Array.from(selectedMembers).map((memberId) => ({
    member: reportUsers.find((member) => member.id === memberId),
    report: selectedReports.find((report) => report.userId === memberId),
  }));
  const leaderReport = teamLeader
    ? selectedReports.find((report) => report.userId === teamLeader.id) ?? null
    : null;
  const totalSubmitters = members.length + (teamLeader ? 1 : 0);

  const toggleSelectedMember = (memberId: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const toggleSelectedLeader = () => {
    if (!teamLeader) return;
    toggleSelectedMember(teamLeader.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-slate-900">팀원 제출 현황</h2>
        <Button type="button" onClick={() => setWriteOpen(true)}>
          <PenLine className="h-4 w-4" />
          주간보고 작성
        </Button>
      </div>

      <Card
        title="선택 주차 제출 현황"
        action={
          <div className="relative text-sm font-medium text-transparent">
            <span className="absolute inset-0 text-slate-500">
              {selectedReports.length}/{totalSubmitters} 제출
            </span>
            {selectedReports.length}/{members.length} 제출
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
            <TeamSubmissionCalendar
              visibleMonth={visibleMonth}
              selectedWeekKey={selectedWeekKey}
              members={members}
              submitterCount={totalSubmitters}
              reportsByWeek={reportsByWeek}
              onSelectWeek={setSelectedWeekKey}
              onMonthChange={setVisibleMonth}
            />

            <TeamOrgChart
              team={team}
              teamId={user.teamId}
              leaderId={teamLeader?.id ?? null}
              leaderName={teamLeader?.name ?? user.name}
              leaderReport={leaderReport}
              members={members}
              selectedReports={selectedReports}
              selectedMembers={selectedMembers}
              onToggleLeader={toggleSelectedLeader}
              onToggleMember={toggleSelectedMember}
              onRefresh={() => void loadData({ silent: true })}
              refreshing={refreshing}
            />
          </div>

          <div className="min-h-[520px] overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
            {selectedReportsByMember.length === 0 ? (
              <div className="flex h-full min-h-[420px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                팀원을 선택하면 제출한 주간보고를 카드로 확인할 수 있습니다.
              </div>
            ) : (
              <div
                className={cn(
                  "grid gap-4",
                  selectedReportsByMember.length === 1 && "grid-cols-1",
                  selectedReportsByMember.length === 2 && "grid-cols-2 min-w-[38rem]",
                  selectedReportsByMember.length === 3 && "grid-cols-3 min-w-[57rem]",
                  selectedReportsByMember.length >= 4 && "grid-cols-4 min-w-[76rem]"
                )}
              >
                {selectedReportsByMember.map(({ member, report }) => (
                  <div
                    key={member?.id}
                    className="max-h-[520px] min-h-[320px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-4"
                  >
                    {report ? (
                      <WeeklyReportPreviewCard
                        report={report}
                        authorName={memberNames[report.userId] ?? report.userId}
                      />
                    ) : (
                      <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                        {member?.name ?? "선택한 팀원"}은 아직 이 주차 보고서를 제출하지 않았습니다.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Modal
        open={writeOpen}
        onClose={() => setWriteOpen(false)}
        title="주간보고 작성"
        size="full"
        bodyClassName="flex overflow-hidden p-0"
      >
        <WeeklyReportForm
          key={`team-write-${selectedWeekKey}`}
          initialWeekKey={selectedWeekKey}
          onSaved={() => {
            loadData();
          }}
          onCancel={() => setWriteOpen(false)}
          showHeader
        />
      </Modal>
    </div>
  );
}

export default function TeamReportPage() {
  return (
    <RoleGuard allowed={["team_leader", "admin"]}>
      <TeamConsolidateContent />
    </RoleGuard>
  );
}
