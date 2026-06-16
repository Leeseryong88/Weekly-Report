import { generateId } from "@/lib/utils";
import type { Importance, ProgressStatus, ReportTaskItem, WeeklyReport } from "@/types";
import { PROGRESS_LABELS } from "@/types";

export type ReportSectionKey =
  | "weeklyWorkItems"
  | "requestItems"
  | "deptHeadDirectiveItems"
  | "specialNoteItems";

export const REPORT_SECTION_LABELS: Record<ReportSectionKey, string> = {
  weeklyWorkItems: "주간업무",
  requestItems: "의사결정사항",
  deptHeadDirectiveItems: "부서장 지시",
  specialNoteItems: "특이사항",
};

export const REPORT_SECTIONS: {
  key: ReportSectionKey;
  label: string;
  optional?: boolean;
}[] = [
  { key: "weeklyWorkItems", label: REPORT_SECTION_LABELS.weeklyWorkItems },
  { key: "requestItems", label: REPORT_SECTION_LABELS.requestItems, optional: true },
  { key: "deptHeadDirectiveItems", label: REPORT_SECTION_LABELS.deptHeadDirectiveItems, optional: true },
  { key: "specialNoteItems", label: REPORT_SECTION_LABELS.specialNoteItems, optional: true },
];

export type ReportFormSections = Record<ReportSectionKey, ReportTaskItem[]>;

const IMPORTANCE_RANK: Record<Importance, number> = {
  low: 0,
  normal: 1,
  high: 2,
  urgent: 3,
};

const STATUS_RANK: Record<ProgressStatus, number> = {
  completed: 0,
  in_progress: 1,
  delayed: 2,
  issue: 3,
};

export function createEmptyTaskItem(overrides: Partial<ReportTaskItem> = {}): ReportTaskItem {
  return {
    id: generateId(),
    content: "",
    progress: 0,
    importance: "normal",
    status: "in_progress",
    ...overrides,
  };
}

export function isImportantTaskItem(item: ReportTaskItem): boolean {
  return item.importance === "high" || item.importance === "urgent";
}

export function sortReportItems(items: ReportTaskItem[]): ReportTaskItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const importantDiff =
        Number(isImportantTaskItem(b.item)) - Number(isImportantTaskItem(a.item));
      return importantDiff || a.index - b.index;
    })
    .map(({ item }) => item);
}

export function hasSectionContent(items: ReportTaskItem[]): boolean {
  return items.some((item) => item.content.trim());
}

function legacyTextToItems(text: string, keepEmpty = false): ReportTaskItem[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return keepEmpty ? [createEmptyTaskItem()] : [];
  return lines.map((content) => ({ ...createEmptyTaskItem(), content }));
}

function itemsFromStored(items?: ReportTaskItem[], legacyText = ""): ReportTaskItem[] {
  if (items?.length) {
    return hasSectionContent(items) ? items : [];
  }
  return legacyTextToItems(legacyText);
}

function getWeeklyWorkItems(report: WeeklyReport): ReportTaskItem[] {
  if (report.weeklyWorkItems?.length && hasSectionContent(report.weeklyWorkItems)) {
    return report.weeklyWorkItems;
  }

  const merged = [
    ...itemsFromStored(report.thisWeekWorkItems, report.thisWeekWork),
    ...itemsFromStored(report.nextWeekPlanItems, report.nextWeekPlan),
  ];

  return merged.length > 0 ? merged : [createEmptyTaskItem()];
}

export function getReportSections(report: WeeklyReport): ReportFormSections {
  return {
    weeklyWorkItems: sortReportItems(getWeeklyWorkItems(report)),
    requestItems: sortReportItems(itemsFromStored(report.requestItems, report.requests)),
    deptHeadDirectiveItems: sortReportItems(
      itemsFromStored(report.deptHeadDirectiveItems, report.deptHeadDirectives)
    ),
    specialNoteItems: sortReportItems(itemsFromStored(report.specialNoteItems, report.specialNotes)),
  };
}

export function emptyFormSections(defaultItemPatch: Partial<ReportTaskItem> = {}): ReportFormSections {
  return {
    weeklyWorkItems: [createEmptyTaskItem(defaultItemPatch)],
    requestItems: [],
    deptHeadDirectiveItems: [],
    specialNoteItems: [],
  };
}

export function serializeTaskItems(items: ReportTaskItem[]): string {
  return items
    .filter((item) => item.content.trim())
    .map((item) => {
      const st = PROGRESS_LABELS[item.status];
      return `${item.importance === "high" || item.importance === "urgent" ? "★ " : ""}${item.content} (${st})`;
    })
    .join("\n");
}

export function computeAggregateMeta(items: ReportTaskItem[]): {
  importance: Importance;
  status: ProgressStatus;
} {
  const filled = items.filter((i) => i.content.trim());
  if (filled.length === 0) {
    return { importance: "normal", status: "in_progress" };
  }

  const importance = filled.reduce<Importance>(
    (best, item) =>
      IMPORTANCE_RANK[item.importance] > IMPORTANCE_RANK[best] ? item.importance : best,
    "normal"
  );

  const status = filled.reduce<ProgressStatus>(
    (worst, item) =>
      STATUS_RANK[item.status] > STATUS_RANK[worst] ? item.status : worst,
    "completed"
  );

  return { importance, status };
}

export function computeReportMeta(sections: ReportFormSections) {
  const allItems = [
    ...sections.weeklyWorkItems,
    ...sections.requestItems,
    ...sections.deptHeadDirectiveItems,
    ...sections.specialNoteItems,
  ];
  return computeAggregateMeta(allItems);
}

export function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}
