"use client";

import { useEffect, useState } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select, FormField, Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { getAllUsers, getAllTeams } from "@/lib/firestore/services";
import { useAdminApi } from "@/hooks/useAdminApi";
import type { User, UserRole, Team } from "@/types";
import { ROLE_LABELS } from "@/types";

function generateTempPassword() {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 10; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function AdminUsersContent() {
  const { callAdminApi } = useAdminApi();
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string } | null>(null);
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<{
    email: string;
    role: UserRole;
    teamId: string;
    isActive: boolean;
  }>({
    email: "",
    role: "member",
    teamId: "",
    isActive: true,
  });
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: generateTempPassword(),
    role: "member" as UserRole,
    teamId: "",
  });

  const load = async () => {
    const [u, t] = await Promise.all([getAllUsers({ includeInactive: true }), getAllTeams()]);
    setUsers(u);
    setTeams(t);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (user: User) => {
    setEditError("");
    setEditing(user.id);
    setEditForm({
      email: user.email,
      role: user.role,
      teamId: user.teamId ?? "",
      isActive: user.isActive,
    });
  };

  const saveEdit = async (uid: string) => {
    const newEmail = editForm.email.trim();
    if (!newEmail) {
      setEditError("이메일을 입력하세요.");
      return;
    }

    setSaving(true);
    setEditError("");
    try {
      await callAdminApi(`/api/admin/users/${uid}`, {
        email: newEmail,
        role: editForm.role,
        teamId: editForm.teamId || null,
        isActive: editForm.isActive,
      }, "PATCH");
      setEditing(null);
      await load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    setCreateError("");
    setCreating(true);
    try {
      await callAdminApi("/api/admin/users", {
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        role: createForm.role,
        teamId: createForm.teamId || null,
      });
      setCreatedInfo({ email: createForm.email, password: createForm.password });
      setCreateOpen(false);
      setCreateForm({
        name: "",
        email: "",
        password: generateTempPassword(),
        role: "member",
        teamId: "",
      });
      load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "계정 생성 실패");
    } finally {
      setCreating(false);
    }
  };

  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">사용자 관리</h2>
          <p className="text-slate-500">관리자가 계정을 생성하고 권한·로그인 이메일·활성 상태를 관리합니다.</p>
        </div>
        <Button
          onClick={() => {
            setCreateError("");
            setCreateForm((f) => ({ ...f, password: generateTempPassword() }));
            setCreateOpen(true);
          }}
        >
          계정 생성
        </Button>
      </div>

      {createdInfo && (
        <Card title="계정 생성 완료">
          <p className="text-sm text-slate-600">
            아래 임시 비밀번호를 사용자에게 전달하세요. 최초 로그인 시 비밀번호 변경이 필요합니다.
          </p>
          <div className="mt-3 rounded-lg bg-slate-50 p-3 font-mono text-sm">
            <p>이메일: {createdInfo.email}</p>
            <p>임시 비밀번호: {createdInfo.password}</p>
          </div>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreatedInfo(null)}>
            닫기
          </Button>
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b">
                <th className="pb-2 pr-4">이름</th>
                <th className="pb-2 pr-4">이메일</th>
                <th className="pb-2 pr-4">권한</th>
                <th className="pb-2 pr-4">팀</th>
                <th className="pb-2 pr-4">상태</th>
                <th className="pb-2">관리</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-50">
                  <td className="py-3 pr-4">{u.name}</td>
                  <td className="py-3 pr-4">
                    {editing === u.id ? (
                      <Input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        required
                      />
                    ) : (
                      u.email
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {editing === u.id ? (
                      <Select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                      >
                        {Object.entries(ROLE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </Select>
                    ) : (
                      ROLE_LABELS[u.role]
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {editing === u.id ? (
                      <Select
                        value={editForm.teamId}
                        onChange={(e) => setEditForm({ ...editForm, teamId: e.target.value })}
                      >
                        <option value="">없음</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </Select>
                    ) : (
                      u.teamId ? teamMap[u.teamId] : "-"
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {editing === u.id ? (
                      <Select
                        value={editForm.isActive ? "active" : "inactive"}
                        onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === "active" })}
                      >
                        <option value="active">활성</option>
                        <option value="inactive">비활성</option>
                      </Select>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={u.isActive ? "success" : "muted"}>
                          {u.isActive ? "활성" : "비활성"}
                        </Badge>
                        {u.mustChangePassword && (
                          <Badge variant="warning">비밀번호 변경 필요</Badge>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3">
                    {editing === u.id ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveEdit(u.id)} disabled={saving}>
                            {saving ? "저장 중..." : "저장"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditing(null);
                              setEditError("");
                            }}
                            disabled={saving}
                          >
                            취소
                          </Button>
                        </div>
                        {editError && <p className="text-xs text-red-600">{editError}</p>}
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => startEdit(u)}>편집</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="새 계정 생성"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>취소</Button>
            <Button onClick={handleCreate} disabled={creating}>생성</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="이름">
            <Input
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              required
            />
          </FormField>
          <FormField label="이메일">
            <Input
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              required
            />
          </FormField>
          <FormField label="임시 비밀번호">
            <div className="flex gap-2">
              <Input
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                minLength={6}
                required
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateForm({ ...createForm, password: generateTempPassword() })}
              >
                재생성
              </Button>
            </div>
          </FormField>
          <FormField label="권한">
            <Select
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
            >
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="소속 팀">
            <Select
              value={createForm.teamId}
              onChange={(e) => setCreateForm({ ...createForm, teamId: e.target.value })}
            >
              <option value="">없음</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </FormField>
          {createError && <p className="text-sm text-red-600">{createError}</p>}
          <p className="text-xs text-slate-400">
            생성된 사용자는 최초 로그인 시 비밀번호를 변경해야 합니다.
          </p>
        </div>
      </Modal>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <RoleGuard allowed={["admin"]}>
      <AdminUsersContent />
    </RoleGuard>
  );
}
