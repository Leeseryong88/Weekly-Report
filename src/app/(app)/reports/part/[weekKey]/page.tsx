"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
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
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { WeeklyReportPreviewCard } from "@/components/reports/WeeklyReportPreviewCard";
import {
  getAllTeams,
  getAllUsers,
  getTeamReportsByWeek,
  getWeeklyReportsByUsersAndWeek,
} from "@/lib/firestore/services";
import { cn } from "@/lib/utils";
import { getWeekKey } from "@/lib/week-key";
import type { Team, TeamReport, User, WeeklyReport } from "@/types";

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

function PartSubmissionCalendar({
  visibleMonth,
  selectedWeekKey,
  teams,
  reportsByWeek,
  onSelectWeek,
  onMonthChange,
}: {
  visibleMonth: Date;
  selectedWeekKey: string;
  teams: Team[];
  reportsByWeek: Map<string, TeamReport[]>;
  onSelectWeek: (weekKey: string) => void;
  onMonthChange: (month: Date) => void;
}) {
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const { days } = useMemo(() => getMonthWeekKeys(visibleMonth), [visibleMonth]);
  const selectedWeekStart = parseISO(selectedWeekKey);
  const selectedReports = reportsByWeek.get(selectedWeekKey) ?? [];
  const submittedCount = selectedReports.filter((report) => report.submitStatus === "submitted").length;
  const totalCount = teams.length;
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

function TeamReportOrg({
  teams,
  users,
  partLeaderName,
  leaderNames,
  selectedWeeklyReports,
  selectedPeople,
  onTogglePerson,
}: {
  teams: Team[];
  users: User[];
  partLeaderName: string;
  leaderNames: Record<string, string>;
  selectedWeeklyReports: WeeklyReport[];
  selectedPeople: Set<string>;
  onTogglePerson: (userId: string) => void;
}) {
  return (
    <div className="flex min-h-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="w-full max-w-6xl">
        <div className="flex justify-center">
          <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-2 text-sm shadow-sm">
            <span className="font-semibold text-blue-700">파트</span>
            <span className="h-4 w-px bg-slate-200" />
            <span className="font-semibold text-slate-900">파트장({partLeaderName})</span>
          </div>
        </div>

        {teams.length > 0 && <div className="mx-auto h-5 w-px bg-slate-300" />}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {teams.map((team) => {
            const fallbackLeader = users.find(
              (item) => item.teamId === team.id && item.role === "team_leader"
            );
            const leaderId = team.leaderUserId || fallbackLeader?.id || null;
            const leaderReport = leaderId
              ? selectedWeeklyReports.find((item) => item.userId === leaderId)
              : undefined;
            const submitted = leaderReport?.submitStatus === "submitted";
            const selected = leaderId ? selectedPeople.has(leaderId) : false;
            const leaderName = leaderId
              ? leaderNames[leaderId] ?? fallbackLeader?.name ?? "미지정"
              : "미지정";
            const members = users.filter(
              (item) => item.teamId === team.id && item.role === "member" && item.id !== leaderId
            );

            return (
              <div key={team.id} className="flex min-w-0 flex-col items-center">
                <button
                  type="button"
                  onClick={() => leaderId && onTogglePerson(leaderId)}
                  disabled={!leaderId}
                  title={leaderId ? `${leaderName} 주간보고 보기` : `${team.name} 팀장 미지정`}
                  className={cn(
                    "flex min-h-16 w-full max-w-full flex-col items-center justify-center gap-1 rounded-lg border bg-white px-3 py-2 text-sm shadow-sm transition-colors",
                    selected
                      ? "border-blue-300 bg-blue-50 ring-2 ring-blue-100"
                      : "border-blue-200 hover:border-blue-300 hover:bg-white",
                    !leaderId && "cursor-default opacity-70"
                  )}
                >
                  <span className="flex max-w-full items-center justify-center gap-2">
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                        submitted
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-slate-200 bg-slate-50 text-slate-300"
                      )}
                      aria-hidden="true"
                    >
                      {submitted && <Check className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 truncate font-semibold text-blue-700">
                      {team.name}
                    </span>
                  </span>
                  <span className="max-w-full truncate text-xs font-semibold text-slate-700">
                    팀장({leaderName})
                  </span>
                </button>

                <div className="mx-auto h-4 w-px bg-slate-300" />
                <div className="flex w-full flex-wrap justify-center gap-1.5 rounded-lg border border-slate-200 bg-white/70 p-2.5">
                  {members.length > 0 ? (
                    members.map((member) => {
                      const memberReport = selectedWeeklyReports.find(
                        (item) => item.userId === member.id
                      );
                      const memberSelected = selectedPeople.has(member.id);

                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => onTogglePerson(member.id)}
                          className={cn(
                            "inline-flex h-7 max-w-32 items-center rounded-full border bg-white px-2 text-xs font-semibold transition-colors",
                            memberSelected
                              ? "border-blue-300 bg-blue-50 ring-2 ring-blue-100"
                              : "border-slate-200 hover:border-blue-200 hover:bg-white"
                          )}
                        >
                          <span
                            className={cn(
                              "mr-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                              memberReport?.submitStatus === "submitted"
                                ? "border-green-200 bg-green-50 text-green-700"
                                : "border-slate-200 bg-slate-50 text-slate-300"
                            )}
                            aria-hidden="true"
                          >
                            {memberReport?.submitStatus === "submitted" && (
                              <Check className="h-3 w-3" />
                            )}
                          </span>
                          <span className="min-w-0 truncate">{member.name}</span>
                        </button>
                      );
                    })
                  ) : (
                    <span className="text-xs text-slate-400">등록된 팀원 없음</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeeklyReportPreview({
  person,
  report,
}: {
  person: User | undefined;
  report: WeeklyReport | undefined;
}) {
  return (
    <div className="max-h-[520px] min-h-[320px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-4">
      {report ? (
        <WeeklyReportPreviewCard report={report} authorName={person?.name ?? report.userId} />
      ) : (
        <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
          {person?.name ?? "선택한 인원"}은 아직 이 주차 주간보고서를 제출하지 않았습니다.
        </div>
      )}
    </div>
  );
}

function PartReportContent() {
  const { user } = useAuth();
  const params = useParams();
  const initialWeekKey = params.weekKey as string;

  const [visibleMonth, setVisibleMonth] = useState(() => parseISO(initialWeekKey));
  const [selectedWeekKey, setSelectedWeekKey] = useState(initialWeekKey);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [leaderNames, setLeaderNames] = useState<Record<string, string>>({});
  const [reportsByWeek, setReportsByWeek] = useState<Map<string, TeamReport[]>>(new Map());
  const [weeklyReportsByWeek, setWeeklyReportsByWeek] = useState<Map<string, WeeklyReport[]>>(new Map());
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { weekKeys } = getMonthWeekKeys(visibleMonth);
    const [allTeams, users] = await Promise.all([getAllTeams(), getAllUsers()]);
    const reportUserIds = users
      .filter((item) => item.role === "team_leader" || item.role === "member")
      .map((item) => item.id);
    const [reportGroups, weeklyReportGroups] = await Promise.all([
      Promise.all(weekKeys.map((weekKey) => getTeamReportsByWeek(weekKey))),
      Promise.all(
        weekKeys.map((weekKey) => getWeeklyReportsByUsersAndWeek(reportUserIds, weekKey))
      ),
    ]);

    const nextReportsByWeek = new Map<string, TeamReport[]>();
    const nextWeeklyReportsByWeek = new Map<string, WeeklyReport[]>();
    weekKeys.forEach((weekKey, index) => {
      nextReportsByWeek.set(weekKey, reportGroups[index]);
      nextWeeklyReportsByWeek.set(
        weekKey,
        weeklyReportGroups[index].filter((report) => report.submitStatus === "submitted")
      );
    });

    setTeams(allTeams);
    setUsers(users);
    setLeaderNames(Object.fromEntries(users.map((user: User) => [user.id, user.name])));
    setReportsByWeek(nextReportsByWeek);
    setWeeklyReportsByWeek(nextWeeklyReportsByWeek);
    setLoading(false);
  }, [visibleMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <LoadingSpinner size="lg" />;

  const selectedReports = reportsByWeek.get(selectedWeekKey) ?? [];
  const selectedWeeklyReports = weeklyReportsByWeek.get(selectedWeekKey) ?? [];
  const selectedReportsByPerson = Array.from(selectedPeople).map((userId) => ({
    person: users.find((person) => person.id === userId),
    report: selectedWeeklyReports.find((report) => report.userId === userId),
  }));

  const toggleSelectedPerson = (userId: string) => {
    setSelectedPeople((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">파트 보고 취합</h2>

      <Card
        title="선택 주차 팀 보고 현황"
        action={
          <div className="text-sm font-medium text-slate-500">
            {selectedReports.filter((report) => report.submitStatus === "submitted").length}/{teams.length} 제출
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
            <PartSubmissionCalendar
              visibleMonth={visibleMonth}
              selectedWeekKey={selectedWeekKey}
              teams={teams}
              reportsByWeek={reportsByWeek}
              onSelectWeek={setSelectedWeekKey}
              onMonthChange={setVisibleMonth}
            />

            <TeamReportOrg
              teams={teams}
              users={users}
              partLeaderName={user?.role === "part_leader" ? user.name : "관리자"}
              leaderNames={leaderNames}
              selectedWeeklyReports={selectedWeeklyReports}
              selectedPeople={selectedPeople}
              onTogglePerson={toggleSelectedPerson}
            />
          </div>

          <div className="min-h-[520px] overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
            {selectedReportsByPerson.length === 0 ? (
              <div className="flex h-full min-h-[420px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                팀명 또는 팀원을 선택하면 제출한 주간보고서를 확인할 수 있습니다.
              </div>
            ) : (
              <div
                className={cn(
                  "grid gap-4",
                  selectedReportsByPerson.length === 1 && "grid-cols-1",
                  selectedReportsByPerson.length === 2 && "grid-cols-2 min-w-[38rem]",
                  selectedReportsByPerson.length === 3 && "grid-cols-3 min-w-[57rem]",
                  selectedReportsByPerson.length >= 4 && "grid-cols-4 min-w-[76rem]"
                )}
              >
                {selectedReportsByPerson.map(({ person, report }) => (
                  <WeeklyReportPreview key={person?.id} person={person} report={report} />
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function PartReportPage() {
  return (
    <RoleGuard allowed={["part_leader", "admin"]}>
      <PartReportContent />
    </RoleGuard>
  );
}
