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
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Modal } from "@/components/ui/Modal";
import { SubmitStatusBadge } from "@/components/ui/StatusBadge";
import { ReportDetailView } from "@/components/reports/ReportDetailView";
import { WeeklyReportForm } from "@/components/reports/WeeklyReportForm";
import { useAuth } from "@/contexts/AuthContext";
import { deleteWeeklyReport, getWeeklyReportsByUser } from "@/lib/firestore/services";
import { cn } from "@/lib/utils";
import { getCurrentWeekKey, getWeekKey, getWeekLabel } from "@/lib/week-key";
import type { ReportTaskStatus, WeeklyReport } from "@/types";

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
    <Card title="주간보고 캘린더" className="h-fit">
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
        <p className="text-base font-semibold text-slate-900">
          {format(visibleMonth, "yyyy년 M월")}
        </p>
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

function ReportStatusList({
  reports,
  currentReport,
  onSelectReport,
  onWriteCurrentWeek,
}: {
  reports: WeeklyReport[];
  currentReport: WeeklyReport | null;
  onSelectReport: (report: WeeklyReport) => void;
  onWriteCurrentWeek: () => void;
}) {
  const recentReports = reports.slice(0, 6);

  return (
    <div className="space-y-5">
      <Card
        title="이번 주 보고"
        action={
          currentReport ? (
            <SubmitStatusBadge status={currentReport.submitStatus} />
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
              미작성
            </span>
          )
        }
      >
        {currentReport ? (
          <button
            type="button"
            onClick={() => onSelectReport(currentReport)}
            className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/30"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-slate-400" />
              <span className="font-medium text-slate-900">
                {getWeekLabel(currentReport.weekKey)}
              </span>
            </div>
            <TaskStatusCountBadges report={currentReport} />
          </button>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm font-medium text-slate-700">이번 주 보고서가 없습니다.</p>
            <Button type="button" className="mt-3" onClick={onWriteCurrentWeek}>
              <PenLine className="h-4 w-4" />
              주간보고 작성
            </Button>
          </div>
        )}
      </Card>

      <Card title="최근 주간보고">
        {recentReports.length === 0 ? (
          <EmptyState title="보고서가 없습니다" />
        ) : (
          <div className="space-y-3">
            {recentReports.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => onSelectReport(report)}
                className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/30"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900">
                    {weekRangeLabel(report.weekKey)}
                  </span>
                  <SubmitStatusBadge status={report.submitStatus} />
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function MemberWeeklyReportContent() {
  const { user, loading: authLoading } = useAuth();
  const currentWeekKey = getCurrentWeekKey();
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [writeOpen, setWriteOpen] = useState(false);
  const [writeWeekKey, setWriteWeekKey] = useState(currentWeekKey);
  const [writeFormKey, setWriteFormKey] = useState<string | null>(null);
  const [editReport, setEditReport] = useState<WeeklyReport | null>(null);
  const [detailReport, setDetailReport] = useState<WeeklyReport | null>(null);

  const loadReports = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) return;
    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      const data = await getWeeklyReportsByUser(user.id);
      setReports(data.sort((a, b) => b.weekKey.localeCompare(a.weekKey)));
    } catch {
      setReports([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadReports();
    });
  }, [loadReports]);

  const openWriteModal = (targetWeekKey = currentWeekKey, report: WeeklyReport | null = null) => {
    setWriteWeekKey(targetWeekKey);
    setEditReport(report);
    setWriteFormKey(report?.id ?? `member-write-${targetWeekKey}-${Date.now()}`);
    setWriteOpen(true);
  };

  const closeWriteModal = () => {
    setWriteOpen(false);
    setEditReport(null);
    setWriteFormKey(null);
  };

  const handleWeekSelect = (targetWeekKey: string, report: WeeklyReport | null) => {
    if (!report || report.submitStatus === "draft") {
      openWriteModal(targetWeekKey, report);
      return;
    }
    setDetailReport(report);
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
    await loadReports({ silent: true });
  };

  if (authLoading || loading) return <LoadingSpinner size="lg" />;

  const currentReport = reports.find((report) => report.weekKey === currentWeekKey) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">주간보고</h2>
          <p className="text-slate-500">주간보고 작성과 제출 상태를 확인합니다.</p>
        </div>
        <Button onClick={() => openWriteModal(currentWeekKey, currentReport)}>
          <PenLine className="h-4 w-4" />
          주간보고 작성
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <MemberWeekCalendar reports={reports} onSelectWeek={handleWeekSelect} />
        <ReportStatusList
          reports={reports}
          currentReport={currentReport}
          onSelectReport={(report) => handleWeekSelect(report.weekKey, report)}
          onWriteCurrentWeek={() => openWriteModal(currentWeekKey, currentReport)}
        />
      </div>

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
              loadReports({ silent: true });
            }}
            onCancel={closeWriteModal}
            showHeader
          />
        )}
      </Modal>

      <Modal open={!!detailReport} onClose={() => setDetailReport(null)} title="보고서 상세" size="xl">
        {detailReport && user && (
          <ReportDetailView
            report={detailReport}
            authorName={user.name}
            teamName={detailReport.teamId}
            canManage={detailReport.userId === user.id}
            onEdit={detailReport.userId === user.id ? handleEditFromDetail : undefined}
            onDelete={detailReport.userId === user.id ? handleDeleteReport : undefined}
          />
        )}
      </Modal>
    </div>
  );
}

export default function WriteReportPage() {
  return (
    <RoleGuard allowed={["member"]}>
      <MemberWeeklyReportContent />
    </RoleGuard>
  );
}
