import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  type QueryConstraint,
  type Unsubscribe,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import {
  docToUser,
  docToTeam,
  docToWeeklyReport,
  docToTeamReport,
  docToPartReport,
  docToActionItem,
} from "./converters";
import type {
  User,
  Team,
  WeeklyReport,
  TeamReport,
  PartReport,
  ActionItem,
  UserRole,
  Importance,
  ProgressStatus,
  ActionItemStatus,
  MergedItem,
  ReportTaskItem,
} from "@/types";

type UserQueryOptions = {
  includeInactive?: boolean;
};

export async function getUser(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const user = docToUser(snap as never);
  return user.isActive ? user : null;
}

export function subscribeToUser(
  uid: string,
  onChange: (user: User | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "users", uid),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      const user = docToUser(snap as never);
      onChange(user.isActive ? user : null);
    },
    (error) => {
      onChange(null);
      onError?.(error);
    }
  );
}

export async function getAllUsers(options: UserQueryOptions = {}): Promise<User[]> {
  const usersRef = collection(db, "users");
  const usersQuery = options.includeInactive
    ? usersRef
    : query(usersRef, where("isActive", "==", true));
  const snap = await getDocs(usersQuery);
  return snap.docs.map((d) => docToUser(d));
}

export async function getUsersByRoles(
  roles: UserRole[],
  options: UserQueryOptions = {}
): Promise<User[]> {
  if (roles.length === 0) return [];

  const constraints: QueryConstraint[] = [where("role", "in", roles)];
  if (!options.includeInactive) constraints.push(where("isActive", "==", true));

  const q = query(collection(db, "users"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToUser(d));
}

export async function getUsersByTeam(
  teamId: string,
  options: UserQueryOptions = {}
): Promise<User[]> {
  const constraints: QueryConstraint[] = [where("teamId", "==", teamId)];
  if (!options.includeInactive) constraints.push(where("isActive", "==", true));
  const q = query(collection(db, "users"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToUser(d));
}

export async function createUser(
  uid: string,
  data: { name: string; email: string; role: UserRole; teamId: string | null }
) {
  await setDoc(doc(db, "users", uid), {
    ...data,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateUser(
  uid: string,
  data: Partial<{
    name: string;
    role: UserRole;
    teamId: string | null;
    isActive: boolean;
    mustChangePassword: boolean;
  }>
) {
  await updateDoc(doc(db, "users", uid), { ...data, updatedAt: serverTimestamp() });
}

export async function clearMustChangePassword(uid: string) {
  await updateDoc(doc(db, "users", uid), {
    mustChangePassword: false,
    updatedAt: serverTimestamp(),
  });
}

export async function getAllTeams(): Promise<Team[]> {
  const snap = await getDocs(collection(db, "teams"));
  return snap.docs.map((d) => docToTeam(d));
}

export async function getTeam(teamId: string): Promise<Team | null> {
  const snap = await getDoc(doc(db, "teams", teamId));
  if (!snap.exists()) return null;
  return docToTeam(snap as never);
}

export async function createTeam(data: { name: string; leaderUserId: string | null }) {
  const id = doc(collection(db, "teams")).id;
  await setDoc(doc(db, "teams", id), data);
  return id;
}

export async function updateTeam(
  teamId: string,
  data: Partial<{ name: string; leaderUserId: string | null }>
) {
  await updateDoc(doc(db, "teams", teamId), data);
}

export async function getWeeklyReport(userId: string, weekKey: string): Promise<WeeklyReport | null> {
  const q = query(
    collection(db, "weeklyReports"),
    where("userId", "==", userId),
    where("weekKey", "==", weekKey)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return docToWeeklyReport(snap.docs[0]);
}

export async function getWeeklyReportsByTeam(
  teamId: string,
  weekKey: string
): Promise<WeeklyReport[]> {
  const q = query(
    collection(db, "weeklyReports"),
    where("teamId", "==", teamId),
    where("weekKey", "==", weekKey)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToWeeklyReport(d));
}

export async function getWeeklyReportsByUser(userId: string): Promise<WeeklyReport[]> {
  const q = query(
    collection(db, "weeklyReports"),
    where("userId", "==", userId),
    orderBy("weekKey", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToWeeklyReport(d));
}

export async function getWeeklyReportsByUsersAndWeek(
  userIds: string[],
  weekKey: string
): Promise<WeeklyReport[]> {
  const reports = await Promise.all(userIds.map((userId) => getWeeklyReport(userId, weekKey)));
  return reports.filter((report): report is WeeklyReport => report !== null);
}

export async function getSubmittedWeeklyReport(
  userId: string,
  weekKey: string
): Promise<WeeklyReport | null> {
  const q = query(
    collection(db, "weeklyReports"),
    where("userId", "==", userId),
    where("weekKey", "==", weekKey),
    where("submitStatus", "==", "submitted")
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return docToWeeklyReport(snap.docs[0]);
}

export async function getSubmittedWeeklyReportsByUsersAndWeek(
  userIds: string[],
  weekKey: string
): Promise<WeeklyReport[]> {
  const reports = await Promise.all(
    userIds.map((userId) => getSubmittedWeeklyReport(userId, weekKey))
  );
  return reports.filter((report): report is WeeklyReport => report !== null);
}

export async function getWeeklyReportsByUsers(userIds: string[]): Promise<WeeklyReport[]> {
  const reportGroups = await Promise.all(userIds.map((userId) => getWeeklyReportsByUser(userId)));
  return reportGroups.flat();
}

export async function saveWeeklyReport(
  reportId: string | null,
  data: {
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
    submitStatus: "draft" | "submitted";
  }
): Promise<string> {
  const id = reportId ?? doc(collection(db, "weeklyReports")).id;
  const payload: Record<string, unknown> = {
    ...data,
    updatedAt: serverTimestamp(),
  };
  if (!reportId) {
    payload.createdAt = serverTimestamp();
    payload.teamLeaderComment = "";
  }
  if (data.submitStatus === "submitted") {
    payload.submittedAt = serverTimestamp();
  }
  await setDoc(doc(db, "weeklyReports", id), payload, { merge: true });
  return id;
}

export async function deleteWeeklyReport(reportId: string, fileUrls: string[] = []) {
  const currentUser = auth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken();
    const res = await fetch(`/api/reports/${reportId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return;
    if (res.status !== 503) {
      throw new Error(typeof data.error === "string" ? data.error : "보고서 삭제에 실패했습니다.");
    }
  }

  await Promise.all(fileUrls.map((url) => deleteReportFile(url)));
  await deleteDoc(doc(db, "weeklyReports", reportId));
}

export async function uploadReportFile(
  userId: string,
  weekKey: string,
  file: File
): Promise<string> {
  const path = `reports/${userId}/${weekKey}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function deleteReportFile(fileUrl: string) {
  try {
    const storageRef = ref(storage, fileUrl);
    await deleteObject(storageRef);
  } catch {
    // ignore if already deleted
  }
}

export async function getTeamReport(
  teamId: string,
  weekKey: string
): Promise<TeamReport | null> {
  const q = query(
    collection(db, "teamReports"),
    where("teamId", "==", teamId),
    where("weekKey", "==", weekKey)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return docToTeamReport(snap.docs[0]);
}

export async function saveTeamReport(
  reportId: string | null,
  data: {
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
    submitStatus: "draft" | "submitted";
  }
): Promise<string> {
  const id = reportId ?? doc(collection(db, "teamReports")).id;
  const payload: Record<string, unknown> = {
    ...data,
    updatedAt: serverTimestamp(),
  };
  if (!reportId) payload.createdAt = serverTimestamp();
  if (data.submitStatus === "submitted") payload.submittedAt = serverTimestamp();
  await setDoc(doc(db, "teamReports", id), payload, { merge: true });
  return id;
}

export async function getTeamReportsByWeek(weekKey: string): Promise<TeamReport[]> {
  const q = query(collection(db, "teamReports"), where("weekKey", "==", weekKey));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToTeamReport(d));
}

export async function getPartReport(weekKey: string): Promise<PartReport | null> {
  const q = query(collection(db, "partReports"), where("weekKey", "==", weekKey));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return docToPartReport(snap.docs[0]);
}

export async function savePartReport(
  reportId: string | null,
  data: {
    weekKey: string;
    teamReportIds: string[];
    totalSummary: string;
    keyIssues: string;
    keyRequests: string;
    delayedTasks: string;
    partLeaderComment: string;
  }
): Promise<string> {
  const id = reportId ?? doc(collection(db, "partReports")).id;
  const payload = {
    ...data,
    updatedAt: serverTimestamp(),
    ...(reportId ? {} : { createdAt: serverTimestamp() }),
  };
  await setDoc(doc(db, "partReports", id), payload, { merge: true });
  return id;
}

export async function getActionItems(filters?: {
  teamId?: string;
  assigneeUserId?: string;
}): Promise<ActionItem[]> {
  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc")];
  if (filters?.teamId) constraints.unshift(where("teamId", "==", filters.teamId));
  if (filters?.assigneeUserId)
    constraints.unshift(where("assigneeUserId", "==", filters.assigneeUserId));
  const q = query(collection(db, "actionItems"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToActionItem(d));
}

export async function getOpenActionItemsForUser(userId: string): Promise<ActionItem[]> {
  const q = query(
    collection(db, "actionItems"),
    where("assigneeUserId", "==", userId),
    where("status", "in", ["received", "in_progress"])
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToActionItem(d));
}

export async function createActionItem(data: {
  sourceReportId: string;
  sourceType: "weeklyReport" | "teamReport" | "partReport";
  weekKey: string;
  teamId: string | null;
  title: string;
  description: string;
  assigneeUserId: string | null;
  dueDate: string | null;
  createdByUserId: string;
}) {
  const id = doc(collection(db, "actionItems")).id;
  await setDoc(doc(db, "actionItems", id), {
    sourceReportId: data.sourceReportId,
    sourceType: data.sourceType,
    weekKey: data.weekKey,
    teamId: data.teamId,
    title: data.title,
    description: data.description,
    assigneeUserId: data.assigneeUserId,
    status: "received",
    dueDate: data.dueDate,
    history: [
      {
        status: "received",
        note: "요청사항 등록",
        changedAt: serverTimestamp(),
        changedByUserId: data.createdByUserId,
      },
    ],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function updateActionItemStatus(
  id: string,
  status: ActionItemStatus,
  userId: string,
  note: string
) {
  const snap = await getDoc(doc(db, "actionItems", id));
  if (!snap.exists()) return;
  const history = snap.data().history ?? [];
  await updateDoc(doc(db, "actionItems", id), {
    status,
    history: [
      ...history,
      {
        status,
        note,
        changedAt: serverTimestamp(),
        changedByUserId: userId,
      },
    ],
    updatedAt: serverTimestamp(),
  });
}

export async function updateActionItem(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    assigneeUserId: string | null;
    dueDate: string | null;
  }>
) {
  await updateDoc(doc(db, "actionItems", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function searchWeeklyReports(
  weekKey?: string,
  teamId?: string,
  userId?: string
): Promise<WeeklyReport[]> {
  const constraints: QueryConstraint[] = [];
  if (weekKey) constraints.push(where("weekKey", "==", weekKey));
  if (teamId) constraints.push(where("teamId", "==", teamId));
  if (userId) constraints.push(where("userId", "==", userId));
  const q = query(collection(db, "weeklyReports"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToWeeklyReport(d));
}
