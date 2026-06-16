import {
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import type {
  User,
  Team,
  WeeklyReport,
  TeamReport,
  PartReport,
  ActionItem,
  Comment,
} from "@/types";

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date();
}

export function docToUser(snap: QueryDocumentSnapshot<DocumentData>): User {
  const d = snap.data();
  return {
    id: snap.id,
    name: d.name ?? "",
    email: d.email ?? "",
    role: d.role,
    teamId: d.teamId ?? null,
    isActive: d.isActive ?? true,
    mustChangePassword: d.mustChangePassword ?? false,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}

export function docToTeam(snap: QueryDocumentSnapshot<DocumentData>): Team {
  const d = snap.data();
  return {
    id: snap.id,
    name: d.name ?? "",
    leaderUserId: d.leaderUserId ?? null,
  };
}

export function docToWeeklyReport(snap: QueryDocumentSnapshot<DocumentData>): WeeklyReport {
  const d = snap.data();
  return {
    id: snap.id,
    weekKey: d.weekKey,
    userId: d.userId,
    teamId: d.teamId,
    thisWeekWork: d.thisWeekWork ?? "",
    nextWeekPlan: d.nextWeekPlan ?? "",
    requests: d.requests ?? "",
    deptHeadDirectives: d.deptHeadDirectives ?? "",
    specialNotes: d.specialNotes ?? "",
    weeklyWorkItems: d.weeklyWorkItems ?? undefined,
    thisWeekWorkItems: d.thisWeekWorkItems ?? undefined,
    nextWeekPlanItems: d.nextWeekPlanItems ?? undefined,
    requestItems: d.requestItems ?? undefined,
    deptHeadDirectiveItems: d.deptHeadDirectiveItems ?? undefined,
    specialNoteItems: d.specialNoteItems ?? undefined,
    importance: d.importance ?? "normal",
    status: d.status ?? "in_progress",
    fileUrls: d.fileUrls ?? [],
    submitStatus: d.submitStatus ?? "draft",
    teamLeaderComment: d.teamLeaderComment ?? "",
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
    submittedAt: d.submittedAt ? toDate(d.submittedAt) : null,
  };
}

export function docToTeamReport(snap: QueryDocumentSnapshot<DocumentData>): TeamReport {
  const d = snap.data();
  return {
    id: snap.id,
    weekKey: d.weekKey,
    teamId: d.teamId,
    leaderUserId: d.leaderUserId,
    memberReportIds: d.memberReportIds ?? [],
    summary: d.summary ?? "",
    mergedItems: d.mergedItems ?? [],
    requests: d.requests ?? "",
    issues: d.issues ?? "",
    risks: d.risks ?? "",
    leaderComment: d.leaderComment ?? "",
    submitStatus: d.submitStatus ?? "draft",
    submittedAt: d.submittedAt ? toDate(d.submittedAt) : null,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}

export function docToPartReport(snap: QueryDocumentSnapshot<DocumentData>): PartReport {
  const d = snap.data();
  return {
    id: snap.id,
    weekKey: d.weekKey,
    teamReportIds: d.teamReportIds ?? [],
    totalSummary: d.totalSummary ?? "",
    keyIssues: d.keyIssues ?? "",
    keyRequests: d.keyRequests ?? "",
    delayedTasks: d.delayedTasks ?? "",
    partLeaderComment: d.partLeaderComment ?? "",
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}

export function docToActionItem(snap: QueryDocumentSnapshot<DocumentData>): ActionItem {
  const d = snap.data();
  return {
    id: snap.id,
    sourceReportId: d.sourceReportId,
    sourceType: d.sourceType,
    weekKey: d.weekKey ?? "",
    teamId: d.teamId ?? null,
    title: d.title ?? "",
    description: d.description ?? "",
    assigneeUserId: d.assigneeUserId ?? null,
    status: d.status ?? "received",
    dueDate: d.dueDate ?? null,
    history: (d.history ?? []).map((h: DocumentData) => ({
      status: h.status,
      note: h.note ?? "",
      changedAt: toDate(h.changedAt),
      changedByUserId: h.changedByUserId,
    })),
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}

export function docToComment(snap: QueryDocumentSnapshot<DocumentData>): Comment {
  const d = snap.data();
  return {
    id: snap.id,
    targetType: d.targetType,
    targetId: d.targetId,
    writerUserId: d.writerUserId,
    content: d.content,
    createdAt: toDate(d.createdAt),
  };
}
