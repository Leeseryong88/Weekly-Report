export type UserRole = "admin" | "part_leader" | "team_leader" | "member";

export type SubmitStatus = "draft" | "submitted";

export type Importance = "low" | "normal" | "high" | "urgent";

export type ProgressStatus = "completed" | "in_progress" | "delayed" | "issue";

export type ReportTaskStatus = "in_progress" | "completed" | "delayed";

export interface ReportTaskItem {
  id: string;
  content: string;
  progress: number;
  importance: Importance;
  status: ReportTaskStatus;
  assigneeUserId?: string | null;
  assigneeName?: string;
}

export type ActionItemStatus = "received" | "in_progress" | "completed" | "on_hold";

export type CommentTargetType =
  | "weeklyReport"
  | "teamReport"
  | "partReport"
  | "actionItem";

export type ActionItemSourceType = "weeklyReport" | "teamReport" | "partReport";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Team {
  id: string;
  name: string;
  leaderUserId: string | null;
}

export interface WeeklyReport {
  id: string;
  weekKey: string;
  userId: string;
  teamId: string;
  thisWeekWork: string;
  nextWeekPlan: string;
  requests: string;
  deptHeadDirectives: string;
  specialNotes: string;
  weeklyWorkItems?: ReportTaskItem[];
  thisWeekWorkItems?: ReportTaskItem[];
  nextWeekPlanItems?: ReportTaskItem[];
  requestItems?: ReportTaskItem[];
  deptHeadDirectiveItems?: ReportTaskItem[];
  specialNoteItems?: ReportTaskItem[];
  importance: Importance;
  status: ProgressStatus;
  fileUrls: string[];
  submitStatus: SubmitStatus;
  teamLeaderComment: string;
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
}

export interface MergedItem {
  id: string;
  content: string;
  sourceReportIds: string[];
  order: number;
}

export interface TeamReport {
  id: string;
  weekKey: string;
  teamId: string;
  leaderUserId: string;
  memberReportIds: string[];
  summary: string;
  mergedItems: MergedItem[];
  requests: string;
  issues: string;
  risks: string;
  leaderComment: string;
  submitStatus: SubmitStatus;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PartReport {
  id: string;
  weekKey: string;
  teamReportIds: string[];
  totalSummary: string;
  keyIssues: string;
  keyRequests: string;
  delayedTasks: string;
  partLeaderComment: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActionItemHistoryEntry {
  status: ActionItemStatus;
  note: string;
  changedAt: Date;
  changedByUserId: string;
}

export interface ActionItem {
  id: string;
  sourceReportId: string;
  sourceType: ActionItemSourceType;
  weekKey: string;
  teamId: string | null;
  title: string;
  description: string;
  assigneeUserId: string | null;
  status: ActionItemStatus;
  dueDate: string | null;
  history: ActionItemHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: string;
  targetType: CommentTargetType;
  targetId: string;
  writerUserId: string;
  content: string;
  createdAt: Date;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "전체 관리자",
  part_leader: "파트장",
  team_leader: "팀장",
  member: "팀원",
};

export const IMPORTANCE_LABELS: Record<Importance, string> = {
  low: "낮음",
  normal: "보통",
  high: "높음",
  urgent: "긴급",
};

export const PROGRESS_LABELS: Record<ProgressStatus, string> = {
  completed: "완료",
  in_progress: "진행 중",
  delayed: "지연",
  issue: "이슈",
};

export const TASK_STATUS_LABELS: Record<ReportTaskStatus, string> = {
  in_progress: "진행 중",
  completed: "완료",
  delayed: "지연",
};

export const ACTION_STATUS_LABELS: Record<ActionItemStatus, string> = {
  received: "접수",
  in_progress: "진행 중",
  completed: "완료",
  on_hold: "보류",
};

export const TEAM_SEEDS = [
  { id: "asset-ops", name: "자산운영팀" },
  { id: "esh", name: "ESH팀" },
  { id: "food-culture", name: "푸드컬처팀" },
  { id: "procurement", name: "구매기획팀" },
] as const;
