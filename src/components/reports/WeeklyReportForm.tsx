"use client";

import { useEffect, useState } from "react";
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
  subDays,
  subMonths,
} from "date-fns";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Save,
  Send,
  Star,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/Input";
import { SubmitStatusBadge } from "@/components/ui/StatusBadge";
import { ReportSectionEditor } from "@/components/reports/ReportSectionEditor";
import { getCurrentWeekKey, getWeekKey, getWeekLabel } from "@/lib/week-key";
import { cn } from "@/lib/utils";
import {
  getUsersByTeam,
  getWeeklyReport,
  getWeeklyReportsByUsersAndWeek,
  saveWeeklyReport,
} from "@/lib/firestore/services";
import {
  computeReportMeta,
  createEmptyTaskItem,
  emptyFormSections,
  getReportSections,
  hasSectionContent,
  REPORT_SECTIONS,
  serializeTaskItems,
  type ReportFormSections,
  type ReportSectionKey,
} from "@/lib/report-items";
import type { WeeklyReport } from "@/types";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface WeeklyReportFormProps {
  initialWeekKey?: string;
  initialReport?: WeeklyReport | null;
  lockWeek?: boolean;
  onSaved?: (report: WeeklyReport) => void;
  onCancel?: () => void;
  showHeader?: boolean;
}

const WEEKDAY_LABELS = ["토", "일", "월", "화", "수", "목", "금"];

function SectionToggleBadge({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium",
        checked
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
        disabled ? "cursor-default opacity-90" : "cursor-pointer"
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded border",
          checked ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"
        )}
      >
        {checked && <Check className="h-3 w-3" />}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        className="sr-only"
      />
      {label}
    </label>
  );
}

function applyLoadedSections(loaded: ReportFormSections) {
  return {
    sections: {
      weeklyWorkItems: loaded.weeklyWorkItems,
      requestItems: loaded.requestItems,
      specialNoteItems: loaded.specialNoteItems,
    },
    showRequests: hasSectionContent(loaded.requestItems),
    showSpecialNotes: hasSectionContent(loaded.specialNoteItems),
  };
}

function WeekCalendar({
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
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 6 }),
    end: endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 6 }),
  });

  useEffect(() => {
    setVisibleMonth(selectedWeekStart);
  }, [selectedWeekKey]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setVisibleMonth((month) => subMonths(month, 1))}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label="이전 달"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-slate-900">{format(visibleMonth, "yyyy년 M월")}</p>
        <button
          type="button"
          onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
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
              onClick={() => onSelectWeek(day)}
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
    </div>
  );
}

function TeamMemberReferencePanel({
  reports,
  memberNames,
  loading,
}: {
  reports: WeeklyReport[];
  memberNames: Record<string, string>;
  loading: boolean;
}) {
  return (
    <aside className="space-y-3 lg:sticky lg:top-0 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto">
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">팀원 보고 참고</p>
            <p className="text-xs text-slate-500">선택 주차 제출 보고서</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            {reports.length}건
          </span>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : reports.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
            제출된 팀원 보고서가 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const sections = getReportSections(report);
              const filledSections = REPORT_SECTIONS.map((section) => ({
                section,
                items: sections[section.key].filter((item) => item.content.trim()),
              })).filter(({ section, items }) => !section.optional || items.length > 0);

              return (
                <div key={report.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {memberNames[report.userId] ?? report.userId}
                    </p>
                    <SubmitStatusBadge status={report.submitStatus} />
                  </div>

                  <div className="space-y-2">
                    {filledSections.map(({ section, items }) => (
                      <div key={section.key}>
                        <p className="mb-1 text-[11px] font-semibold text-slate-500">
                          {section.label}
                        </p>
                        <ul className="space-y-1">
                          {items.slice(0, 4).map((item) => (
                            <li
                              key={item.id}
                              className="rounded-md bg-white px-2 py-1.5 text-xs text-slate-700"
                            >
                              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                                <span className="flex h-4 w-4 items-center justify-center">
                                  {(item.importance === "high" || item.importance === "urgent") && (
                                    <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                                  )}
                                </span>
                                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                  {item.progress}%
                                </span>
                                <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                                  {item.status === "completed"
                                    ? "완료"
                                    : item.status === "delayed"
                                      ? "지연"
                                      : "진행중"}
                                </span>
                              </div>
                              <p className="line-clamp-2 whitespace-pre-wrap">{item.content}</p>
                            </li>
                          ))}
                          {items.length > 4 && (
                            <li className="px-2 text-[11px] font-medium text-slate-400">
                              외 {items.length - 4}건
                            </li>
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

export function WeeklyReportForm({
  initialWeekKey,
  initialReport,
  lockWeek = false,
  onSaved,
  onCancel,
  showHeader = true,
}: WeeklyReportFormProps) {
  const { user } = useAuth();
  const currentWeekKey = getCurrentWeekKey();

  const [selectedWeekKey, setSelectedWeekKey] = useState(
    initialReport?.weekKey ?? initialWeekKey ?? currentWeekKey
  );
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [sections, setSections] = useState<ReportFormSections>(emptyFormSections);
  const [showRequests, setShowRequests] = useState(false);
  const [showSpecialNotes, setShowSpecialNotes] = useState(false);
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [teamMemberReports, setTeamMemberReports] = useState<WeeklyReport[]>([]);
  const [teamMemberNames, setTeamMemberNames] = useState<Record<string, string>>({});
  const [teamMemberReportsLoading, setTeamMemberReportsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) return;

    const loadFromReport = (r: WeeklyReport | null) => {
      if (r) {
        const applied = applyLoadedSections(getReportSections(r));
        setReport(r);
        setSections(applied.sections);
        setShowRequests(applied.showRequests);
        setShowSpecialNotes(applied.showSpecialNotes);
        setFileUrls(r.fileUrls);
      } else {
        setReport(null);
        setSections(emptyFormSections());
        setShowRequests(false);
        setShowSpecialNotes(false);
        setFileUrls([]);
      }
    };

    if (initialReport && initialReport.weekKey === selectedWeekKey) {
      loadFromReport(initialReport);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      const r = await getWeeklyReport(user.id, selectedWeekKey);
      if (cancelled) return;
      loadFromReport(r);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, selectedWeekKey, initialReport]);

  useEffect(() => {
    if (!user?.teamId || user.role !== "team_leader") {
      setTeamMemberReports([]);
      setTeamMemberNames({});
      return;
    }
    const currentTeamId = user.teamId;

    let cancelled = false;
    (async () => {
      setTeamMemberReportsLoading(true);
      try {
        const teamUsers = await getUsersByTeam(currentTeamId);
        const members = teamUsers.filter((item) => item.role === "member");
        const memberIds = members.map((item) => item.id);
        const reports = await getWeeklyReportsByUsersAndWeek(memberIds, selectedWeekKey);
        if (cancelled) return;
        const memberNameMap = Object.fromEntries(members.map((item) => [item.id, item.name]));
        setTeamMemberNames(memberNameMap);
        setTeamMemberReports(
          reports
            .filter((item) => item.submitStatus === "submitted")
            .sort((a, b) =>
              (memberNameMap[a.userId] ?? a.userId).localeCompare(memberNameMap[b.userId] ?? b.userId)
            )
        );
      } catch {
        if (!cancelled) {
          setTeamMemberReports([]);
          setTeamMemberNames({});
        }
      } finally {
        if (!cancelled) setTeamMemberReportsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, selectedWeekKey]);

  const weekStart = parseISO(selectedWeekKey);
  const weekEnd = addDays(weekStart, 6);

  if (loading) return <LoadingSpinner />;
  if (!user?.teamId) {
    return <p className="text-slate-500">소속 팀이 없습니다. 관리자에게 문의하세요.</p>;
  }

  const showTeamMemberReference = user.role === "team_leader";

  const updateSection = (key: ReportSectionKey, items: ReportFormSections[ReportSectionKey]) => {
    setSections((prev) => ({ ...prev, [key]: items }));
  };

  const toggleOptionalSection = (
    key: "requestItems" | "specialNoteItems",
    checked: boolean
  ) => {
    if (key === "requestItems") {
      setShowRequests(checked);
      if (checked && !hasSectionContent(sections.requestItems)) {
        setSections((prev) => ({ ...prev, requestItems: [createEmptyTaskItem()] }));
      }
      return;
    }

    setShowSpecialNotes(checked);
    if (checked && !hasSectionContent(sections.specialNoteItems)) {
      setSections((prev) => ({ ...prev, specialNoteItems: [createEmptyTaskItem()] }));
    }
  };

  const handleSave = async (submitStatus: "draft" | "submitted") => {
    if (!user.teamId) return;
    setSaving(true);
    setMessage("");
    try {
      const weeklyText = serializeTaskItems(sections.weeklyWorkItems);
      const meta = computeReportMeta(sections);
      const id = await saveWeeklyReport(report?.id ?? null, {
        weekKey: selectedWeekKey,
        userId: user.id,
        teamId: user.teamId,
        thisWeekWork: weeklyText,
        nextWeekPlan: "",
        requests: serializeTaskItems(sections.requestItems),
        specialNotes: serializeTaskItems(sections.specialNoteItems),
        weeklyWorkItems: sections.weeklyWorkItems,
        requestItems: sections.requestItems,
        specialNoteItems: sections.specialNoteItems,
        importance: meta.importance,
        status: meta.status,
        fileUrls,
        submitStatus,
      });
      const saved = {
        ...report,
        id,
        weekKey: selectedWeekKey,
        submitStatus,
        weeklyWorkItems: sections.weeklyWorkItems,
        requestItems: sections.requestItems,
        specialNoteItems: sections.specialNoteItems,
        thisWeekWork: weeklyText,
        nextWeekPlan: "",
        requests: serializeTaskItems(sections.requestItems),
        specialNotes: serializeTaskItems(sections.specialNoteItems),
        importance: meta.importance,
        status: meta.status,
        fileUrls,
      } as WeeklyReport;
      setReport(saved);
      setMessage(submitStatus === "submitted" ? "보고서를 제출했습니다." : "임시저장했습니다.");
      onSaved?.(saved);
    } catch {
      setMessage("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleCalendarSelect = (date: Date) => {
    setSelectedWeekKey(getWeekKey(date));
  };

  const handleLoadPreviousWeek = async () => {
    if (!user) return;
    setMessage("");
    try {
      const previousWeekKey = getWeekKey(subDays(parseISO(selectedWeekKey), 7));
      const previousReport = await getWeeklyReport(user.id, previousWeekKey);
      if (!previousReport) {
        setMessage("전주에 작성한 보고서가 없습니다.");
        return;
      }

      const previousSections = getReportSections(previousReport);
      const carryOverItems = previousSections.weeklyWorkItems
        .filter((item) => item.status !== "completed" && item.content.trim())
        .map((item) => ({ ...item, id: createEmptyTaskItem().id }));

      if (carryOverItems.length === 0) {
        setMessage("전주 업무 중 완료되지 않은 항목이 없습니다.");
        return;
      }

      setSections((prev) => ({
        ...prev,
        weeklyWorkItems: carryOverItems,
      }));
      setMessage("전주 미완료 업무를 불러왔습니다.");
    } catch {
      setMessage("전주 업무를 불러오지 못했습니다.");
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-slate-50">
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div
          className={cn(
            "grid w-full gap-4",
            showTeamMemberReference
              ? "xl:grid-cols-[280px_minmax(0,1fr)_340px]"
              : "lg:grid-cols-[280px_minmax(0,1fr)]"
          )}
        >
          {showHeader && (
            <aside className="space-y-3 lg:sticky lg:top-0 lg:self-start">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <FormField label="보고 주간">
                  <WeekCalendar
                    selectedWeekKey={selectedWeekKey}
                    onSelectWeek={handleCalendarSelect}
                  />
                </FormField>
              </div>

              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-blue-700">선택된 주간</span>
                  {selectedWeekKey === currentWeekKey && (
                    <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                      이번 주
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {format(weekStart, "M/d")} 토요일 - {format(weekEnd, "M/d")} 금요일
                </p>
              </div>

              {report && (
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="mb-2 text-xs font-medium text-slate-500">저장 상태</p>
                  <SubmitStatusBadge status={report.submitStatus} />
                </div>
              )}
            </aside>
          )}

          <main className="min-w-0 space-y-5">
            <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
              <SectionToggleBadge label="주간업무진행" checked disabled />
              <SectionToggleBadge
                label="요청사항"
                checked={showRequests}
                onChange={(checked) => toggleOptionalSection("requestItems", checked)}
              />
              <SectionToggleBadge
                label="특이사항"
                checked={showSpecialNotes}
                onChange={(checked) => toggleOptionalSection("specialNoteItems", checked)}
              />
            </div>

            <ReportSectionEditor
              title="주간업무 진행"
              description="이번 주 진행 업무를 항목별로 정리하세요."
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleLoadPreviousWeek}
                  className="h-7 rounded-full border border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-blue-700 hover:border-blue-300 hover:bg-blue-100"
                >
                  전주 불러오기
                </Button>
              }
              items={sections.weeklyWorkItems}
              onChange={(items) => updateSection("weeklyWorkItems", items)}
            />

            {showRequests && (
                <ReportSectionEditor
                  title="요청사항"
                  description="협업, 의사결정, 지원이 필요한 내용을 작성하세요."
                  simple
                  items={sections.requestItems}
                  onChange={(items) => updateSection("requestItems", items)}
                />
            )}

            {showSpecialNotes && (
                <ReportSectionEditor
                  title="특이사항"
                  description="공유가 필요한 이슈, 리스크, 참고사항을 남기세요."
                  simple
                  items={sections.specialNoteItems}
                  onChange={(items) => updateSection("specialNoteItems", items)}
                />
            )}

            {report?.teamLeaderComment && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm">
                <p className="font-medium text-blue-800">팀장 코멘트</p>
                <p className="mt-1 whitespace-pre-wrap text-blue-700">{report.teamLeaderComment}</p>
              </div>
            )}
          </main>

          {showTeamMemberReference && (
            <TeamMemberReferencePanel
              reports={teamMemberReports}
              memberNames={teamMemberNames}
              loading={teamMemberReportsLoading}
            />
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-5 text-sm">
            {message ? (
              <p className="text-green-600">{message}</p>
            ) : (
              <p className="flex items-center gap-1.5 text-slate-500">
                <Clock3 className="h-4 w-4" />
                임시저장 후 제출 전까지 계속 수정할 수 있습니다.
              </p>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {onCancel && (
              <Button variant="outline" onClick={onCancel} disabled={saving}>
                취소
              </Button>
            )}
            <Button variant="outline" onClick={() => handleSave("draft")} disabled={saving}>
              <Save className="h-4 w-4" />
              임시저장
            </Button>
            <Button onClick={() => handleSave("submitted")} disabled={saving}>
              <Send className="h-4 w-4" />
              {report?.submitStatus === "submitted" ? "수정 저장" : "제출"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
