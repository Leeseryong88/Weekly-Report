"use client";

import { useEffect, useMemo, useState } from "react";
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
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SubmitStatusBadge, TaskStatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAllTeams,
  getAllUsers,
  getTeam,
  getUsersByTeam,
  getWeeklyReportsByUsersAndWeek,
} from "@/lib/firestore/services";
import {
  getReportSections,
  isImportantTaskItem,
  REPORT_SECTIONS,
  type ReportSectionKey,
} from "@/lib/report-items";
import { cn } from "@/lib/utils";
import { getCurrentWeekKey, getWeekKey } from "@/lib/week-key";
import type { ReportTaskItem, Team, User, WeeklyReport } from "@/types";

const WEEKDAY_LABELS = ["토", "일", "월", "화", "수", "목", "금"];
const ITEMS_PER_PAGE = 7;

const SECTION_STYLES: Record<
  ReportSectionKey,
  { active: string; count: string; border: string }
> = {
  weeklyWorkItems: {
    active: "border-slate-900 bg-slate-900 text-white",
    count: "bg-slate-100 text-slate-700",
    border: "border-slate-200",
  },
  requestItems: {
    active: "border-blue-600 bg-blue-600 text-white",
    count: "bg-blue-50 text-blue-700",
    border: "border-blue-100",
  },
  specialNoteItems: {
    active: "border-violet-600 bg-violet-600 text-white",
    count: "bg-violet-50 text-violet-700",
    border: "border-violet-100",
  },
};

type StarredSections = Record<ReportSectionKey, ReportTaskItem[]>;

interface TeamWeeklySummary {
  team: Team;
  leader: User | null;
  report: WeeklyReport | null;
  itemsBySection: StarredSections;
}

function emptyStarredSections(): StarredSections {
  return {
    weeklyWorkItems: [],
    requestItems: [],
    specialNoteItems: [],
  };
}

function getMonthDays(month: Date) {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 6 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 6 }),
  });
}

function CompactWeekCalendar({
  selectedWeekKey,
  onSelectWeek,
}: {
  selectedWeekKey: string;
  onSelectWeek: (date: Date) => void;
}) {
  const selectedWeekStart = parseISO(selectedWeekKey);
  const [visibleMonth, setVisibleMonth] = useState(selectedWeekStart);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const today = new Date();
  const days = useMemo(() => getMonthDays(visibleMonth), [visibleMonth]);

  return (
    <div className="w-full rounded-lg border border-slate-200 bg-white p-2 sm:w-56">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setVisibleMonth((month) => subMonths(month, 1))}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label="이전 달"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-xs font-semibold text-slate-900">{format(visibleMonth, "yyyy년 M월")}</p>
        <button
          type="button"
          onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label="다음 달"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-slate-500">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="py-1">
            {label}
          </span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-0.5" onMouseLeave={() => setHoveredDate(null)}>
        {days.map((day) => {
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
              onClick={() => {
                onSelectWeek(day);
                setVisibleMonth(day);
              }}
              className={cn(
                "h-7 text-[11px] transition-colors",
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

      <div className="mt-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700">
        {format(selectedWeekStart, "M/d")} - {format(addDays(selectedWeekStart, 6), "M/d")}
      </div>
    </div>
  );
}

function getTeamLeader(team: Team, users: User[]) {
  if (team.leaderUserId) {
    const assignedLeader = users.find((user) => user.id === team.leaderUserId);
    if (assignedLeader) return assignedLeader;
  }
  return users.find((user) => user.teamId === team.id && user.role === "team_leader") ?? null;
}

function getStarredSections(report: WeeklyReport | null): StarredSections {
  if (!report || report.submitStatus !== "submitted") return emptyStarredSections();
  const sections = getReportSections(report);
  return {
    weeklyWorkItems: sections.weeklyWorkItems.filter(
      (item) => item.content.trim() && isImportantTaskItem(item)
    ),
    requestItems: sections.requestItems.filter(
      (item) => item.content.trim() && isImportantTaskItem(item)
    ),
    specialNoteItems: sections.specialNoteItems.filter(
      (item) => item.content.trim() && isImportantTaskItem(item)
    ),
  };
}

function TeamSummaryCard({
  summary,
  activeSection,
}: {
  summary: TeamWeeklySummary;
  activeSection: ReportSectionKey;
}) {
  const items = summary.itemsBySection[activeSection];
  const styles = SECTION_STYLES[activeSection];
  const showStatus = activeSection === "weeklyWorkItems";
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const hasPagination = items.length > ITEMS_PER_PAGE;
  const visibleItems = items.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
  const rangeStart = page * ITEMS_PER_PAGE + 1;
  const rangeEnd = Math.min((page + 1) * ITEMS_PER_PAGE, items.length);

  useEffect(() => {
    setPage(0);
  }, [activeSection, summary.team.id, items.length]);

  useEffect(() => {
    if (page > totalPages - 1) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [page, totalPages]);

  return (
    <section className={cn("rounded-lg border bg-white p-3", styles.border)}>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-900">{summary.team.name}</h2>
          <p className="text-[11px] text-slate-500">
            {summary.leader?.name ?? "팀장 미지정"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasPagination && (
            <span className="text-[10px] font-semibold text-slate-400">
              {rangeStart}-{rangeEnd} / {items.length}
            </span>
          )}
          {summary.report ? (
            <SubmitStatusBadge status={summary.report.submitStatus} />
          ) : (
            <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
              미제출
            </span>
          )}
        </div>
      </div>

      {items.length > 0 && (
        <div className="space-y-1">
          <ul className="space-y-1">
            {visibleItems.map((item) => (
              <li key={item.id} className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
                <div
                  className={cn(
                    "grid items-start gap-1.5",
                    showStatus
                      ? "grid-cols-[56px_88px_minmax(0,1fr)]"
                      : "grid-cols-[88px_minmax(0,1fr)]"
                  )}
                >
                  {showStatus && (
                    <div className="flex justify-start">
                      <TaskStatusBadge
                        status={item.status}
                        className="w-12 justify-center px-0 py-0 text-[10px] font-semibold"
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    {item.assigneeName?.trim() && (
                      <span className="inline-flex w-full items-center justify-center truncate rounded-full bg-white px-1.5 py-0 text-[10px] font-semibold text-slate-600">
                        {item.assigneeName}
                      </span>
                    )}
                  </div>
                  <span className="min-w-0 flex-1 whitespace-pre-wrap text-[13px] leading-5 text-slate-700">
                    {item.content}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {hasPagination && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                disabled={page === 0}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="이전 항목 보기"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <span className="min-w-[3rem] text-center text-[11px] font-semibold text-slate-500">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                disabled={page >= totalPages - 1}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="다음 항목 보기"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function WeeklySummaryContent() {
  const { user } = useAuth();
  const [selectedWeekKey, setSelectedWeekKey] = useState(getCurrentWeekKey());
  const [activeSection, setActiveSection] = useState<ReportSectionKey>("weeklyWorkItems");
  const [summaries, setSummaries] = useState<TeamWeeklySummary[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        let teams: Team[];
        let users: User[];

        if (user.role === "team_leader") {
          if (!user.teamId) {
            if (!cancelled) setSummaries([]);
            return;
          }
          const [team, teamUsers] = await Promise.all([
            getTeam(user.teamId),
            getUsersByTeam(user.teamId),
          ]);
          teams = team ? [team] : [];
          users = teamUsers;
        } else {
          [teams, users] = await Promise.all([getAllTeams(), getAllUsers()]);
        }

        const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name, "ko"));
        const teamLeaders = sortedTeams.map((team) => getTeamLeader(team, users));
        const leaderIds = Array.from(
          new Set(teamLeaders.map((leader) => leader?.id).filter((id): id is string => Boolean(id)))
        );
        const reports = await getWeeklyReportsByUsersAndWeek(leaderIds, selectedWeekKey);
        const reportByUserId = new Map(reports.map((report) => [report.userId, report]));

        if (cancelled) return;

        setSummaries(
          sortedTeams.map((team, index) => {
            const leader = teamLeaders[index];
            const report = leader ? reportByUserId.get(leader.id) ?? null : null;
            return {
              team,
              leader,
              report,
              itemsBySection: getStarredSections(report),
            };
          })
        );
        setSelectedTeamIds(new Set(sortedTeams.map((team) => team.id)));
      } catch {
        if (!cancelled) setSummaries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedWeekKey, user]);

  const selectedWeeklySummaries = useMemo(
    () => summaries.filter((summary) => selectedTeamIds.has(summary.team.id)),
    [selectedTeamIds, summaries]
  );

  const visibleSummaries = useMemo(
    () => (activeSection === "weeklyWorkItems" ? selectedWeeklySummaries : summaries),
    [activeSection, selectedWeeklySummaries, summaries]
  );

  const sectionCounts = useMemo(() => {
    return REPORT_SECTIONS.reduce<Record<ReportSectionKey, number>>(
      (counts, section) => {
        const targetSummaries =
          section.key === "weeklyWorkItems" ? selectedWeeklySummaries : summaries;

        counts[section.key] = targetSummaries.reduce(
          (total, summary) => total + summary.itemsBySection[section.key].length,
          0
        );
        return counts;
      },
      { weeklyWorkItems: 0, requestItems: 0, specialNoteItems: 0 }
    );
  }, [selectedWeeklySummaries, summaries]);

  const toggleTeam = (teamId: string, checked: boolean) => {
    setSelectedTeamIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(teamId);
      } else {
        next.delete(teamId);
      }
      return next;
    });
  };

  const selectedWeekStart = parseISO(selectedWeekKey);

  return (
    <div className="bg-slate-100 py-4 sm:py-6">
      <div className="mx-auto grid w-full max-w-[1120px] gap-4 px-4 lg:grid-cols-[240px_minmax(0,840px)] lg:items-start lg:justify-center">
        <aside className="lg:sticky lg:top-4">
          <CompactWeekCalendar
            selectedWeekKey={selectedWeekKey}
            onSelectWeek={(date) => setSelectedWeekKey(getWeekKey(date))}
          />
        </aside>

        <article className="min-h-[1120px] w-full rounded-sm border border-slate-200 bg-white px-5 py-6 shadow-[0_18px_50px_rgba(15,23,42,0.12)] sm:px-9 sm:py-8">
          <header className="border-b border-slate-200 pb-6">
            <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Weekly Report Summary
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950">주간보고 취합</h1>
              <p className="mt-2 text-sm text-slate-500">
                {format(selectedWeekStart, "yyyy년 M월 d일")} -{" "}
                {format(addDays(selectedWeekStart, 6), "M월 d일")}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {REPORT_SECTIONS.map((section) => {
                const active = activeSection === section.key;
                return (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => setActiveSection(section.key)}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors",
                      active
                        ? SECTION_STYLES[section.key].active
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {section.label}
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px]",
                        active ? "bg-white/20 text-white" : SECTION_STYLES[section.key].count
                      )}
                    >
                      {sectionCounts[section.key]}
                    </span>
                  </button>
                );
              })}
            </div>
            </div>
            {activeSection === "weeklyWorkItems" && summaries.length > 0 && (
              <div className="mt-4 flex items-center gap-2 overflow-x-auto whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                <span className="shrink-0 text-[11px] font-semibold text-slate-500">팀 표시</span>
                {summaries.map((summary) => (
                  <label
                    key={summary.team.id}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTeamIds.has(summary.team.id)}
                      onChange={(event) => toggleTeam(summary.team.id, event.target.checked)}
                      className="h-3 w-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    {summary.team.name}
                  </label>
                ))}
              </div>
            )}
          </header>

        <div className="mt-6">
          {loading ? (
            <div className="py-20">
              <LoadingSpinner />
            </div>
          ) : summaries.length === 0 ? (
            <EmptyState title="표시할 팀이 없습니다." />
          ) : visibleSummaries.length === 0 ? (
            <EmptyState title="선택된 팀이 없습니다." />
          ) : (
            <div className="space-y-2">
              {visibleSummaries.map((summary) => (
                <TeamSummaryCard
                  key={summary.team.id}
                  summary={summary}
                  activeSection={activeSection}
                />
              ))}
            </div>
          )}
        </div>
      </article>
      </div>
    </div>
  );
}

export default function WeeklySummaryPage() {
  return (
    <RoleGuard allowed={["team_leader", "part_leader", "admin"]}>
      <WeeklySummaryContent />
    </RoleGuard>
  );
}
