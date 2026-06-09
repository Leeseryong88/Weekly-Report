"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SubmitStatusBadge, ProgressBadge, TaskStatusBadge } from "@/components/ui/StatusBadge";
import type { ReportTaskItem, WeeklyReport } from "@/types";
import { getWeekLabel } from "@/lib/week-key";
import { getReportSections, hasSectionContent, REPORT_SECTIONS } from "@/lib/report-items";
import { Paperclip, Star } from "lucide-react";

interface ReportDetailViewProps {
  report: WeeklyReport;
  authorName: string;
  teamName: string;
  canManage?: boolean;
  onEdit?: () => void;
  onDelete?: () => Promise<void>;
}

function SectionItemsTable({ title, items }: { title: string; items: ReportTaskItem[] }) {
  const filled = items.filter((item) => item.content.trim());
  if (filled.length === 0) return null;
  const showAssignee = filled.some((item) => item.assigneeName?.trim());

  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="w-10 px-3 py-2 font-medium" />
              {showAssignee && <th className="w-24 px-3 py-2 font-medium">담당자</th>}
              <th className="px-3 py-2 font-medium">내용</th>
              <th className="w-20 px-3 py-2 font-medium">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filled.map((item) => {
              const important = item.importance === "high" || item.importance === "urgent";
              return (
                <tr key={item.id}>
                  <td className="px-3 py-2">
                    {important && <Star className="h-4 w-4 fill-amber-500 text-amber-500" />}
                  </td>
                  {showAssignee && (
                    <td className="px-3 py-2 text-slate-600">
                      {item.assigneeName?.trim() || "-"}
                    </td>
                  )}
                  <td className="whitespace-pre-wrap px-3 py-2 text-slate-700">{item.content}</td>
                  <td className="px-3 py-2">
                    <TaskStatusBadge status={item.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReportDetailView({
  report,
  authorName,
  teamName,
  canManage,
  onEdit,
  onDelete,
}: ReportDetailViewProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const sections = getReportSections(report);

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await onDelete();
      setConfirmDelete(false);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "보고서 삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-slate-900">{authorName}</span>
        <span className="text-sm text-slate-400">{teamName}</span>
        <span className="text-sm text-slate-400">{getWeekLabel(report.weekKey)}</span>
        <SubmitStatusBadge status={report.submitStatus} />
        <ProgressBadge status={report.status} />
      </div>

      {REPORT_SECTIONS.map((section) => {
        const items = sections[section.key];
        if (section.optional && !hasSectionContent(items)) return null;
        return <SectionItemsTable key={section.key} title={section.label} items={items} />;
      })}

      {report.fileUrls.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-700">관련 파일</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {report.fileUrls.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-blue-600 hover:underline"
              >
                <Paperclip className="h-3 w-3" />
                첨부 파일
              </a>
            ))}
          </div>
        </div>
      )}

      {report.teamLeaderComment && (
        <div className="rounded-lg bg-blue-50 p-3 text-sm">
          <p className="font-medium text-blue-800">팀장 코멘트</p>
          <p className="mt-1 whitespace-pre-wrap text-blue-700">{report.teamLeaderComment}</p>
        </div>
      )}

      {canManage && (onEdit || onDelete) && (
        <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
          {onEdit && <Button onClick={onEdit}>수정하기</Button>}
          {onDelete && !confirmDelete && (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              삭제하기
            </Button>
          )}
          {onDelete && confirmDelete && (
            <div className="flex w-full flex-col gap-3 rounded-lg bg-red-50 p-3">
              <p className="text-sm text-red-700">
                이 보고서를 삭제하시겠습니까? 되돌릴 수 없습니다.
              </p>
              {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
              <div className="flex flex-wrap gap-3">
                <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
                  {deleting ? "삭제 중..." : "삭제 확인"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setConfirmDelete(false);
                    setDeleteError("");
                  }}
                  disabled={deleting}
                >
                  취소
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
