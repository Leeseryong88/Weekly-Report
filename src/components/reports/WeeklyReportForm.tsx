"use client";

import { useEffect, useRef, useState } from "react";
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
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Save,
  Send,
  Star,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/Input";
import { SubmitStatusBadge, TaskStatusBadge } from "@/components/ui/StatusBadge";
import { ReportSectionEditor } from "@/components/reports/ReportSectionEditor";
import { getCurrentWeekKey, getWeekKey } from "@/lib/week-key";
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
  sortReportItems,
  type ReportFormSections,
  type ReportSectionKey,
} from "@/lib/report-items";
import type { ReportTaskItem, WeeklyReport } from "@/types";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface WeeklyReportFormProps {
  initialWeekKey?: string;
  initialReport?: WeeklyReport | null;
  lockWeek?: boolean;
  onSaved?: (report: WeeklyReport) => void;
  onCancel?: () => void;
  showHeader?: boolean;
}

interface ReportItemAssignee {
  userId: string | null;
  name: string;
}

const WEEKDAY_LABELS = ["토", "일", "월", "화", "수", "목", "금"];

const SECTION_DESCRIPTIONS: Record<ReportSectionKey, string> = {
  weeklyWorkItems: "이번 주 진행 업무를 항목별로 정리하세요.",
  requestItems: "의사결정이 필요하거나 합의해야 하는 내용을 정리하세요.",
  specialNoteItems: "공유가 필요한 이슈, 리스크, 참고사항을 남기세요.",
};

function SelectableMemberReportItem({
  item,
  selected,
  onSelect,
  onAdd,
  onCancel,
}: {
  item: ReportTaskItem;
  selected: boolean;
  onSelect: () => void;
  onAdd: () => void;
  onCancel: () => void;
}) {
  return (
    <li
      className={cn(
        "rounded-md bg-white px-2 py-1.5 text-xs text-slate-700 shadow-sm transition hover:bg-blue-50",
        selected && "bg-blue-50 ring-2 ring-blue-100"
      )}
    >
      <button type="button" className="w-full text-left" onClick={onSelect}>
        <div className="flex items-start gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center">
            {(item.importance === "high" || item.importance === "urgent") && (
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            )}
          </span>
          <TaskStatusBadge status={item.status} className="shrink-0 px-1.5 py-0.5 text-[10px]" />
          <span className="min-w-0 flex-1 line-clamp-3 whitespace-pre-wrap pt-[1px]">
            {item.content}
          </span>
        </div>
      </button>
      {selected && (
        <div className="mt-2 flex justify-end gap-1.5">
          <Button
            type="button"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={(event) => {
              event.stopPropagation();
              onAdd();
            }}
          >
            추가
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={(event) => {
              event.stopPropagation();
              onCancel();
            }}
          >
            취소
          </Button>
        </div>
      )}
    </li>
  );
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
  selectedItemId,
  onSelectItem,
  onAddItem,
}: {
  reports: WeeklyReport[];
  memberNames: Record<string, string>;
  loading: boolean;
  selectedItemId: string | null;
  onSelectItem: (itemId: string | null) => void;
  onAddItem: (
    sectionKey: ReportSectionKey,
    item: ReportTaskItem,
    assignee: ReportItemAssignee
  ) => void;
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
              const memberName = memberNames[report.userId] ?? report.userId;
              const filledSections = REPORT_SECTIONS.map((section) => ({
                section,
                items: sections[section.key].filter((item) => item.content.trim()),
              })).filter(({ section, items }) => !section.optional || items.length > 0);

              return (
                <div key={report.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {memberName}
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
                          {items.map((item) => {
                            const itemId = `member-report:${report.id}:${section.key}:${item.id}`;
                            return (
                              <SelectableMemberReportItem
                                key={item.id}
                                item={item}
                                selected={selectedItemId === itemId}
                                onSelect={() => onSelectItem(itemId)}
                                onAdd={() =>
                                  onAddItem(section.key, item, {
                                    userId: report.userId,
                                    name: memberName,
                                  })
                                }
                                onCancel={() => onSelectItem(null)}
                              />
                            );
                          })}
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
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [teamMemberReports, setTeamMemberReports] = useState<WeeklyReport[]>([]);
  const [teamMemberNames, setTeamMemberNames] = useState<Record<string, string>>({});
  const [teamMemberReportsLoading, setTeamMemberReportsLoading] = useState(false);
  const [selectedMemberReportItemId, setSelectedMemberReportItemId] = useState<string | null>(null);
  const [showDecisionSection, setShowDecisionSection] = useState(false);
  const [showSpecialNoteSection, setShowSpecialNoteSection] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const hasLoadedOnceRef = useRef(false);
  const loadedInitialReportIdRef = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const initialReportId = initialReport?.id ?? null;
  const initialReportWeekKey = initialReport?.weekKey ?? null;

  useEffect(() => {
    if (!user) return;
    const defaultTaskPatch: Partial<ReportTaskItem> =
      user.role === "team_leader"
        ? { assigneeUserId: user.id, assigneeName: user.name }
        : {};

    const loadFromReport = (r: WeeklyReport | null) => {
      if (r) {
        const loadedSections = getReportSections(r);
        setReport(r);
        setSections(loadedSections);
        setShowDecisionSection(hasSectionContent(loadedSections.requestItems));
        setShowSpecialNoteSection(hasSectionContent(loadedSections.specialNoteItems));
        setFileUrls(r.fileUrls);
      } else {
        setReport(null);
        setSections(emptyFormSections(defaultTaskPatch));
        setShowDecisionSection(false);
        setShowSpecialNoteSection(false);
        setFileUrls([]);
      }
    };

    if (initialReport && initialReport.weekKey === selectedWeekKey) {
      if (loadedInitialReportIdRef.current !== initialReport.id) {
        loadFromReport(initialReport);
        loadedInitialReportIdRef.current = initialReport.id;
      }
      setInitialLoading(false);
      hasLoadedOnceRef.current = true;
      return;
    }

    loadedInitialReportIdRef.current = null;

    let cancelled = false;
    (async () => {
      if (!hasLoadedOnceRef.current) {
        setInitialLoading(true);
      }
      const r = await getWeeklyReport(user.id, selectedWeekKey);
      if (cancelled) return;
      loadFromReport(r);
      setInitialLoading(false);
      hasLoadedOnceRef.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, [
    user?.id,
    user?.role,
    user?.name,
    user?.teamId,
    selectedWeekKey,
    initialReportId,
    initialReportWeekKey,
  ]);

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

  if (initialLoading) return <LoadingSpinner />;
  if (!user?.teamId) {
    return <p className="text-slate-500">소속 팀이 없습니다. 관리자에게 문의하세요.</p>;
  }

  const showTeamMemberReference = user.role === "team_leader";
  const defaultTaskPatch: Partial<ReportTaskItem> = showTeamMemberReference
    ? { assigneeUserId: user.id, assigneeName: user.name }
    : {};
  const createDefaultTaskItem = () => createEmptyTaskItem(defaultTaskPatch);

  const updateSection = (key: ReportSectionKey, items: ReportFormSections[ReportSectionKey]) => {
    setSections((prev) => ({
      ...prev,
      [key]: key === "weeklyWorkItems" && items.length === 0
        ? [createDefaultTaskItem()]
        : sortReportItems(items),
    }));
  };

  const showOptionalSection = (sectionKey: "requestItems" | "specialNoteItems") => {
    if (sectionKey === "requestItems") {
      setShowDecisionSection(true);
    } else {
      setShowSpecialNoteSection(true);
    }

    setSections((prev) => ({
      ...prev,
      [sectionKey]: prev[sectionKey].length > 0 ? prev[sectionKey] : [createDefaultTaskItem()],
    }));
  };

  const addMemberReportItemToSection = (
    sectionKey: ReportSectionKey,
    item: ReportTaskItem,
    assignee: ReportItemAssignee
  ) => {
    if (!item.content.trim()) return;
    const copiedItem: ReportTaskItem = {
      ...item,
      id: createEmptyTaskItem().id,
      content: item.content.trim(),
      assigneeUserId: assignee.userId,
      assigneeName: assignee.name,
    };
    const targetSectionLabel =
      REPORT_SECTIONS.find((section) => section.key === sectionKey)?.label ?? "주간업무";

    if (sectionKey === "requestItems") {
      setShowDecisionSection(true);
    }
    if (sectionKey === "specialNoteItems") {
      setShowSpecialNoteSection(true);
    }

    setSections((prev) => ({
      ...prev,
      [sectionKey]: sortReportItems([
        ...prev[sectionKey].filter((item) => item.content.trim()),
        copiedItem,
      ]),
    }));
    setSelectedMemberReportItemId(null);
    setMessage(`팀원 보고 항목을 ${targetSectionLabel}에 추가했습니다.`);
  };

  const handleSave = async (submitStatus: "draft" | "submitted") => {
    if (!user.teamId) return;
    setSaving(true);
    setMessage("");
    try {
      const savableSections: ReportFormSections = {
        weeklyWorkItems: sections.weeklyWorkItems,
        requestItems: sections.requestItems.filter((item) => item.content.trim()),
        specialNoteItems: sections.specialNoteItems.filter((item) => item.content.trim()),
      };
      const weeklyText = serializeTaskItems(savableSections.weeklyWorkItems);
      const meta = computeReportMeta(savableSections);
      const id = await saveWeeklyReport(report?.id ?? null, {
        weekKey: selectedWeekKey,
        userId: user.id,
        teamId: user.teamId,
        thisWeekWork: weeklyText,
        nextWeekPlan: "",
        requests: serializeTaskItems(savableSections.requestItems),
        specialNotes: serializeTaskItems(savableSections.specialNoteItems),
        weeklyWorkItems: savableSections.weeklyWorkItems,
        requestItems: savableSections.requestItems,
        specialNoteItems: savableSections.specialNoteItems,
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
        weeklyWorkItems: savableSections.weeklyWorkItems,
        requestItems: savableSections.requestItems,
        specialNoteItems: savableSections.specialNoteItems,
        thisWeekWork: weeklyText,
        nextWeekPlan: "",
        requests: serializeTaskItems(savableSections.requestItems),
        specialNotes: serializeTaskItems(savableSections.specialNoteItems),
        importance: meta.importance,
        status: meta.status,
        fileUrls,
      } as WeeklyReport;
      setReport(saved);
      loadedInitialReportIdRef.current = id;
      setMessage(submitStatus === "submitted" ? "보고서를 제출했습니다." : "임시저장했습니다.");
      queueMicrotask(() => onSaved?.(saved));
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
        .map((item) => ({
          ...item,
          id: createEmptyTaskItem().id,
          ...(!item.assigneeName?.trim() ? defaultTaskPatch : {}),
        }));

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

  const isSectionVisible = (sectionKey: ReportSectionKey) => {
    if (sectionKey === "weeklyWorkItems") return true;
    if (sectionKey === "requestItems") {
      return showDecisionSection || hasSectionContent(sections.requestItems);
    }
    return showSpecialNoteSection || hasSectionContent(sections.specialNoteItems);
  };
  const visibleSections = REPORT_SECTIONS.filter((section) => isSectionVisible(section.key));
  const hiddenOptionalSections = REPORT_SECTIONS.filter(
    (section) => section.optional && !isSectionVisible(section.key)
  );

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
            {hiddenOptionalSections.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <span className="text-xs font-semibold text-slate-500">섹션 추가</span>
                {hiddenOptionalSections.map((section) => (
                  <Button
                    key={section.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      showOptionalSection(section.key as "requestItems" | "specialNoteItems")
                    }
                    className="h-8 border-dashed bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    {section.label}
                  </Button>
                ))}
              </div>
            )}

            {visibleSections.map((section) => (
              <ReportSectionEditor
                key={section.key}
                title={section.label}
                description={SECTION_DESCRIPTIONS[section.key]}
                action={
                  section.key === "weeklyWorkItems" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleLoadPreviousWeek}
                      className="h-7 rounded-full border border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-blue-700 hover:border-blue-300 hover:bg-blue-100"
                    >
                      전주 불러오기
                    </Button>
                  ) : undefined
                }
                items={sections[section.key]}
                onChange={(items) => updateSection(section.key, items)}
                required={section.key === "weeklyWorkItems"}
                showStatus={section.key === "weeklyWorkItems"}
                showAssignee={showTeamMemberReference}
                defaultAssigneeUserId={user.id}
                defaultAssigneeName={user.name}
              />
            ))}

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
              selectedItemId={selectedMemberReportItemId}
              onSelectItem={setSelectedMemberReportItemId}
              onAddItem={addMemberReportItemToSection}
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
