import { generateId } from "@/lib/utils";
import type { Importance, ProgressStatus, ReportTaskItem, WeeklyReport } from "@/types";
import { PROGRESS_LABELS } from "@/types";

export type ReportSectionKey = "weeklyWorkItems" | "requestItems" | "specialNoteItems";

export const REPORT_SECTIONS: {
  key: ReportSectionKey;
  label: string;
  optional?: boolean;
}[] = [
  { key: "weeklyWorkItems", label: "주간업무 진행" },
  { key: "requestItems", label: "요청사항", optional: true },
  { key: "specialNoteItems", label: "특이사항", optional: true },
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

export function createEmptyTaskItem(): ReportTaskItem {
  return {
    id: generateId(),
    content: "",
    progress: 0,
    importance: "normal",
    status: "in_progress",
  };
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
    weeklyWorkItems: getWeeklyWorkItems(report),
    requestItems: itemsFromStored(report.requestItems, report.requests),
    specialNoteItems: itemsFromStored(report.specialNoteItems, report.specialNotes),
  };
}

export function emptyFormSections(): ReportFormSections {
  return {
    weeklyWorkItems: [createEmptyTaskItem()],
    requestItems: [],
    specialNoteItems: [],
  };
}

export function serializeTaskItems(items: ReportTaskItem[]): string {
  return items
    .filter((item) => item.content.trim())
    .map((item) => {
      const st = PROGRESS_LABELS[item.status];
      return `${item.importance === "high" || item.importance === "urgent" ? "★ " : ""}${item.content} [${item.progress}%] (${st})`;
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
    ...sections.specialNoteItems,
  ];
  return computeAggregateMeta(allItems);
}

export function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}
