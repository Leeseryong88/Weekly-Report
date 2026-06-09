"use client";

import type {
  SubmitStatus,
  Importance,
  ProgressStatus,
  ActionItemStatus,
  ReportTaskStatus,
} from "@/types";
import {
  IMPORTANCE_LABELS,
  PROGRESS_LABELS,
  ACTION_STATUS_LABELS,
  TASK_STATUS_LABELS,
} from "@/types";
import { Badge } from "./Badge";
import { cn } from "@/lib/utils";

export function SubmitStatusBadge({ status }: { status: SubmitStatus }) {
  if (status === "submitted") return <Badge variant="success">제출완료</Badge>;
  return <Badge variant="warning">임시저장</Badge>;
}

export function NotSubmittedBadge() {
  return <Badge variant="danger">미제출</Badge>;
}

export function ImportanceBadge({ importance }: { importance: Importance }) {
  const map: Record<Importance, "muted" | "info" | "warning" | "danger"> = {
    low: "muted",
    normal: "info",
    high: "warning",
    urgent: "danger",
  };
  return (
    <Badge variant={map[importance]} pulse={importance === "urgent"}>
      {IMPORTANCE_LABELS[importance]}
    </Badge>
  );
}

export function ProgressBadge({ status }: { status: ProgressStatus }) {
  const map: Record<ProgressStatus, "success" | "info" | "warning" | "danger"> = {
    completed: "success",
    in_progress: "info",
    delayed: "danger",
    issue: "danger",
  };
  return <Badge variant={map[status]} className="shrink-0 whitespace-nowrap">{PROGRESS_LABELS[status]}</Badge>;
}

export function TaskStatusBadge({
  status,
  className,
}: {
  status: ReportTaskStatus;
  className?: string;
}) {
  const map: Record<ReportTaskStatus, "success" | "info" | "danger"> = {
    in_progress: "info",
    completed: "success",
    delayed: "danger",
  };
  return (
    <Badge variant={map[status]} className={cn("shrink-0 whitespace-nowrap", className)}>
      {TASK_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ActionStatusBadge({ status }: { status: ActionItemStatus }) {
  const map: Record<ActionItemStatus, "muted" | "info" | "success" | "warning"> = {
    received: "muted",
    in_progress: "info",
    completed: "success",
    on_hold: "warning",
  };
  return <Badge variant={map[status]}>{ACTION_STATUS_LABELS[status]}</Badge>;
}

export function SubmitRateBar({ submitted, total }: { submitted: number; total: number }) {
  const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500">
        <span>제출률</span>
        <span>
          {submitted}/{total} ({pct}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
