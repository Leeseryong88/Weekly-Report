"use client";

import { useRef } from "react";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Plus, Star, Trash2 } from "lucide-react";
import type { ReportTaskItem, ReportTaskStatus } from "@/types";
import { TASK_STATUS_LABELS } from "@/types";
import { clampProgress, createEmptyTaskItem } from "@/lib/report-items";
import { cn } from "@/lib/utils";

interface ReportSectionEditorProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  simple?: boolean;
  items: ReportTaskItem[];
  onChange: (items: ReportTaskItem[]) => void;
}

export function ReportSectionEditor({
  title,
  description,
  action,
  simple = false,
  items,
  onChange,
}: ReportSectionEditorProps) {
  const contentRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const resizeContentTextarea = (node: HTMLTextAreaElement | null) => {
    if (!node) return;
    node.style.height = "auto";
    const lineHeight = 20;
    const verticalPadding = 16;
    const maxHeight = lineHeight * 4 + verticalPadding;
    node.style.height = `${Math.min(node.scrollHeight, maxHeight)}px`;
    node.style.overflowY = node.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  const updateItem = (id: string, patch: Partial<ReportTaskItem>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addItem = () => {
    const nextItem = createEmptyTaskItem();
    onChange([...items, nextItem]);
    window.requestAnimationFrame(() => {
      contentRefs.current[nextItem.id]?.focus();
    });
  };

  const focusContentEnd = (id: string) => {
    window.requestAnimationFrame(() => {
      const node = contentRefs.current[id];
      if (!node) return;
      node.focus();
      const end = node.value.length;
      node.setSelectionRange(end, end);
    });
  };

  const moveToNextOrAddItem = (id: string) => {
    const index = items.findIndex((item) => item.id === id);
    const nextItem = items[index + 1];
    if (nextItem) {
      focusContentEnd(nextItem.id);
      return;
    }
    addItem();
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) {
      onChange([createEmptyTaskItem()]);
      return;
    }
    onChange(items.filter((item) => item.id !== id));
  };

  const removeEmptyItemFromContent = (id: string) => {
    if (items.length <= 1) return;
    const index = items.findIndex((item) => item.id === id);
    const focusTarget = items[Math.max(0, index - 1)]?.id ?? items[index + 1]?.id;
    onChange(items.filter((item) => item.id !== id));
    window.requestAnimationFrame(() => {
      if (focusTarget) contentRefs.current[focusTarget]?.focus();
    });
  };

  const toggleImportant = (item: ReportTaskItem) => {
    updateItem(item.id, {
      importance: item.importance === "high" ? "normal" : "high",
    });
  };

  return (
    <section className="w-full space-y-2">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {action}
          </div>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
      </div>

      <div className="w-full rounded-lg border border-slate-200 bg-slate-50/70 p-3">
        <div
          className={cn(
            "hidden gap-2 px-1 pb-2 text-xs font-medium text-slate-500 md:grid",
            simple
              ? "md:grid-cols-[minmax(220px,1fr)_36px]"
              : "md:grid-cols-[36px_96px_78px_minmax(220px,1fr)_36px]"
          )}
        >
          {!simple && (
            <>
              <span />
              <span>상태</span>
              <span>진행률</span>
            </>
          )}
          <span>{simple ? "내용" : "업무내용"}</span>
          <span />
        </div>

        <div className="space-y-2">
          {items.map((item) => {
            const important = item.importance === "high" || item.importance === "urgent";

            return (
              <div
                key={item.id}
                className={cn(
                  "grid gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:items-center md:p-2",
                  simple
                    ? "md:grid-cols-[minmax(220px,1fr)_36px]"
                    : "md:grid-cols-[36px_96px_78px_minmax(220px,1fr)_36px]"
                )}
              >
                {!simple && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-9 w-9 px-0",
                        important
                          ? "text-amber-500 hover:bg-amber-50 hover:text-amber-600"
                          : "text-slate-300 hover:bg-amber-50 hover:text-amber-500"
                      )}
                      onClick={() => toggleImportant(item)}
                      aria-label={important ? "중요 표시 해제" : "중요 표시"}
                    >
                      <Star className={cn("h-4 w-4", important && "fill-current")} />
                    </Button>

                    <div>
                      <span className="mb-1 block text-xs text-slate-400 md:hidden">상태</span>
                      <Select
                        value={item.status}
                        onChange={(e) => {
                          const status = e.target.value as ReportTaskStatus;
                          updateItem(item.id, {
                            status,
                            ...(status === "completed" ? { progress: 100 } : {}),
                          });
                        }}
                      >
                        {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400 md:hidden">진행률</span>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={item.progress || ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const progress = raw === "" ? 0 : clampProgress(Number(raw));
                          updateItem(item.id, {
                            progress,
                            ...(progress === 100
                              ? { status: "completed" as ReportTaskStatus }
                              : {}),
                          });
                        }}
                        placeholder="0"
                        className="w-full text-center"
                      />
                      <span className="text-xs text-slate-400">%</span>
                    </div>
                  </>
                )}

                <Textarea
                  ref={(node) => {
                  contentRefs.current[item.id] = node;
                  resizeContentTextarea(node);
                }}
                value={item.content}
                onChange={(e) => {
                  updateItem(item.id, { content: e.target.value });
                  resizeContentTextarea(e.currentTarget);
                }}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === "Enter") {
                      if (e.shiftKey || e.altKey) return;
                      e.preventDefault();
                      moveToNextOrAddItem(item.id);
                      return;
                    }
                    if (e.key === "Backspace" && item.content.length === 0) {
                      e.preventDefault();
                      removeEmptyItemFromContent(item.id);
                    }
                  }}
                placeholder="업무 내용을 입력하세요"
                rows={1}
                className="min-h-[38px] min-w-0 resize-none py-2 leading-5"
              />

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 justify-self-end px-0 text-slate-400 hover:text-red-500"
                  onClick={() => removeItem(item.id)}
                  aria-label="항목 삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
            className="h-9 min-w-32 border-dashed bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            aria-label={`${simple ? "내용" : "업무내용"} 항목 추가`}
          >
            <Plus className="h-4 w-4" />
            항목 추가
          </Button>
        </div>
      </div>
    </section>
  );
}
