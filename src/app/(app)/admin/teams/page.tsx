"use client";

import { useEffect, useState } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select, FormField, Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { createTeam, getAllTeams, updateTeam, getAllUsers } from "@/lib/firestore/services";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Team, User } from "@/types";
import { TEAM_SEEDS } from "@/types";

function AdminTeamsContent() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [leaderId, setLeaderId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [createName, setCreateName] = useState("");
  const [createLeaderId, setCreateLeaderId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const load = async () => {
    const [t, u] = await Promise.all([getAllTeams(), getAllUsers()]);
    setTeams(t);
    setUsers(u);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const seedTeams = async () => {
    for (const seed of TEAM_SEEDS) {
      await setDoc(doc(db, "teams", seed.id), {
        name: seed.name,
        leaderUserId: null,
      }, { merge: true });
    }
    load();
  };

  const saveTeam = async (teamId: string) => {
    const nextName = teamName.trim();
    if (!nextName) return;

    await updateTeam(teamId, {
      name: nextName,
      leaderUserId: leaderId || null,
    });
    setEditing(null);
    load();
  };

  const handleCreateTeam = async () => {
    const nextName = createName.trim();
    setCreateError("");

    if (!nextName) {
      setCreateError("팀명을 입력하세요.");
      return;
    }

    if (teams.some((team) => team.name.trim() === nextName)) {
      setCreateError("이미 같은 이름의 팀이 있습니다.");
      return;
    }

    setCreating(true);
    try {
      await createTeam({
        name: nextName,
        leaderUserId: createLeaderId || null,
      });
      setCreateName("");
      setCreateLeaderId("");
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "팀 생성에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <LoadingSpinner size="lg" />;

  const leaders = users.filter((u) => u.role === "team_leader" || u.role === "admin");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">팀 관리</h2>
          <p className="text-slate-500">팀 정보 및 팀장을 지정합니다.</p>
        </div>
        {teams.length === 0 && (
          <Button onClick={seedTeams}>기본 4팀 생성</Button>
        )}
      </div>

      <Card title="새 팀 생성">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)_auto] lg:items-end">
          <FormField label="팀명">
            <Input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="팀명을 입력하세요"
            />
          </FormField>
          <FormField label="팀장">
            <Select value={createLeaderId} onChange={(e) => setCreateLeaderId(e.target.value)}>
              <option value="">미지정</option>
              {leaders.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </FormField>
          <Button type="button" onClick={handleCreateTeam} disabled={creating}>
            {creating ? "생성 중" : "팀 생성"}
          </Button>
        </div>
        {createError && <p className="mt-3 text-sm font-medium text-red-600">{createError}</p>}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {teams.map((team) => (
          <Card key={team.id} title={editing === team.id ? undefined : team.name}>
            {editing === team.id ? (
              <div className="space-y-3">
                <FormField label="팀명">
                  <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} />
                </FormField>
                <FormField label="팀장">
                  <Select value={leaderId} onChange={(e) => setLeaderId(e.target.value)}>
                    <option value="">미지정</option>
                    {leaders.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </Select>
                </FormField>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveTeam(team.id)}>저장</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>취소</Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-500">
                  팀장: {team.leaderUserId ? users.find((u) => u.id === team.leaderUserId)?.name : "미지정"}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    setEditing(team.id);
                    setTeamName(team.name);
                    setLeaderId(team.leaderUserId ?? "");
                  }}
                >
                  편집
                </Button>
              </>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function AdminTeamsPage() {
  return (
    <RoleGuard allowed={["admin"]}>
      <AdminTeamsContent />
    </RoleGuard>
  );
}
