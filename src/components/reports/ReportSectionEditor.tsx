"use client";

import { useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { GripVertical, Plus, Star, Trash2 } from "lucide-react";
import type { ReportTaskItem, ReportTaskStatus } from "@/types";
import { TASK_STATUS_LABELS } from "@/types";
import {
  createEmptyTaskItem,
  isImportantTaskItem,
  sortReportItems,
} from "@/lib/report-items";
import { cn } from "@/lib/utils";

interface ReportSectionEditorProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  items: ReportTaskItem[];
  onChange: (items: ReportTaskItem[]) => void;
  required?: boolean;
  showStatus?: boolean;
  showAssignee?: boolean;
  showDirectiveOwner?: boolean;
  defaultAssigneeUserId?: string | null;
  defaultAssigneeName?: string;
}

const DIRECTIVE_OWNER_OPTIONS: readonly string[] = ["부문장", "본부장", "파트장"];
const CUSTOM_DIRECTIVE_OWNER_VALUE = "__custom__";

interface SortableReportTaskRowProps {
  item: ReportTaskItem;
  important: boolean;
  showStatus: boolean;
  showAssignee: boolean;
  showDirectiveOwner: boolean;
  setContentRef: (id: string, node: HTMLTextAreaElement | null) => void;
  resizeContentTextarea: (node: HTMLTextAreaElement | null) => void;
  onToggleImportant: (item: ReportTaskItem) => void;
  onStatusChange: (itemId: string, status: ReportTaskStatus) => void;
  onAssigneeChange: (itemId: string, assigneeName: string) => void;
  onDirectiveOwnerChange: (
    itemId: string,
    directiveOwner: string,
    mode?: ReportTaskItem["directiveOwnerMode"]
  ) => void;
  onContentChange: (itemId: string, content: string, node: HTMLTextAreaElement) => void;
  onContentKeyDown: (
    item: ReportTaskItem,
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => void;
  onRemove: (itemId: string) => void;
}

function SortableReportTaskRow({
  item,
  important,
  showStatus,
  showAssignee,
  showDirectiveOwner,
  setContentRef,
  resizeContentTextarea,
  onToggleImportant,
  onStatusChange,
  onAssigneeChange,
  onDirectiveOwnerChange,
  onContentChange,
  onContentKeyDown,
  onRemove,
}: SortableReportTaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const directiveOwner = item.directiveOwner?.trim() ?? "";
  const hasPresetDirectiveOwner = DIRECTIVE_OWNER_OPTIONS.includes(directiveOwner);
  const directiveOwnerSelectValue =
    item.directiveOwnerMode !== "custom" && (!directiveOwner || hasPresetDirectiveOwner)
      ? directiveOwner
      : CUSTOM_DIRECTIVE_OWNER_VALUE;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "grid gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:items-center md:p-2",
        showStatus && showAssignee && showDirectiveOwner
          ? "md:grid-cols-[28px_36px_96px_120px_132px_minmax(220px,1fr)_36px]"
          : showStatus && showAssignee
            ? "md:grid-cols-[28px_36px_96px_120px_minmax(220px,1fr)_36px]"
            : showStatus && showDirectiveOwner
              ? "md:grid-cols-[28px_36px_96px_132px_minmax(220px,1fr)_36px]"
              : showAssignee && showDirectiveOwner
                ? "md:grid-cols-[28px_36px_120px_132px_minmax(220px,1fr)_36px]"
                : showStatus
                  ? "md:grid-cols-[28px_36px_96px_minmax(220px,1fr)_36px]"
                  : showAssignee
                    ? "md:grid-cols-[28px_36px_120px_minmax(220px,1fr)_36px]"
                    : showDirectiveOwner
                      ? "md:grid-cols-[28px_36px_132px_minmax(220px,1fr)_36px]"
                      : "md:grid-cols-[28px_36px_minmax(220px,1fr)_36px]",
        isDragging && "relative z-10 border-blue-300 shadow-lg ring-2 ring-blue-100"
      )}
    >
      <button
        type="button"
        className="flex h-9 w-7 cursor-grab items-center justify-center rounded-md text-slate-300 hover:bg-slate-50 hover:text-slate-500 active:cursor-grabbing"
        aria-label="항목 순서 변경"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

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
        onClick={() => onToggleImportant(item)}
        aria-label={important ? "중요 표시 해제" : "중요 표시"}
      >
        <Star className={cn("h-4 w-4", important && "fill-current")} />
      </Button>

      {showStatus && (
        <div>
          <span className="mb-1 block text-xs text-slate-400 md:hidden">상태</span>
          <Select
            value={item.status}
            onChange={(e) => onStatusChange(item.id, e.target.value as ReportTaskStatus)}
          >
            {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
      )}

      {showAssignee && (
        <div>
          <span className="mb-1 block text-xs text-slate-400 md:hidden">담당자</span>
          <Input
            value={item.assigneeName ?? ""}
            onChange={(e) => onAssigneeChange(item.id, e.target.value)}
            placeholder="담당자"
          />
        </div>
      )}

      {showDirectiveOwner && (
        <div className="space-y-1">
          <span className="block text-xs text-slate-400 md:hidden">부서장</span>
          <Select
            value={directiveOwnerSelectValue}
            onChange={(e) => {
              const nextValue = e.target.value;
              if (nextValue === CUSTOM_DIRECTIVE_OWNER_VALUE) {
                onDirectiveOwnerChange(item.id, hasPresetDirectiveOwner ? "" : directiveOwner, "custom");
                return;
              }
              onDirectiveOwnerChange(item.id, nextValue);
            }}
          >
            <option value="">선택</option>
            {DIRECTIVE_OWNER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            <option value={CUSTOM_DIRECTIVE_OWNER_VALUE}>직접입력</option>
          </Select>
          {directiveOwnerSelectValue === CUSTOM_DIRECTIVE_OWNER_VALUE && (
            <Input
              value={directiveOwner}
              onChange={(e) => onDirectiveOwnerChange(item.id, e.target.value, "custom")}
              placeholder="부서장 입력"
            />
          )}
        </div>
      )}

      <Textarea
        ref={(node) => {
          setContentRef(item.id, node);
          resizeContentTextarea(node);
        }}
        value={item.content}
        onChange={(e) => onContentChange(item.id, e.target.value, e.currentTarget)}
        onKeyDown={(e) => onContentKeyDown(item, e)}
        placeholder="업무 내용을 입력하세요"
        rows={1}
        className="min-h-[38px] min-w-0 resize-none py-2 leading-5"
      />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 w-9 justify-self-end px-0 text-slate-400 hover:text-red-500"
        onClick={() => onRemove(item.id)}
        aria-label="항목 삭제"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function ReportSectionEditor({
  title,
  description,
  action,
  items,
  onChange,
  required = false,
  showStatus = true,
  showAssignee = false,
  showDirectiveOwner = false,
  defaultAssigneeUserId = null,
  defaultAssigneeName = "",
}: ReportSectionEditorProps) {
  const contentRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
    onChange(
      sortReportItems(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    onChange(sortReportItems(arrayMove(items, oldIndex, newIndex)));
  };

  const addItem = () => {
    const nextItem = createEmptyTaskItem(
      showAssignee
        ? {
            assigneeUserId: defaultAssigneeUserId,
            assigneeName: defaultAssigneeName,
          }
        : undefined
    );
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
      onChange(
        required
          ? [
              createEmptyTaskItem(
                showAssignee
                  ? {
                      assigneeUserId: defaultAssigneeUserId,
                      assigneeName: defaultAssigneeName,
                    }
                  : undefined
              ),
            ]
          : []
      );
      return;
    }
    onChange(items.filter((item) => item.id !== id));
  };

  const removeEmptyItemFromContent = (id: string) => {
    if (items.length <= 1) {
      if (!required) onChange([]);
      return;
    }
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

  const updateStatus = (id: string, status: ReportTaskStatus) => {
    updateItem(id, {
      status,
      ...(status === "completed" ? { progress: 100 } : {}),
    });
  };

  const updateAssigneeName = (id: string, assigneeName: string) => {
    updateItem(id, {
      assigneeName,
      assigneeUserId: null,
    });
  };

  const updateDirectiveOwner = (
    id: string,
    directiveOwner: string,
    mode?: ReportTaskItem["directiveOwnerMode"]
  ) => {
    onChange(
      sortReportItems(
        items.map((item) => {
          if (item.id !== id) return item;
          const next: ReportTaskItem = { ...item, directiveOwner };
          if (mode) {
            next.directiveOwnerMode = mode;
          } else {
            delete next.directiveOwnerMode;
          }
          return next;
        })
      )
    );
  };

  const updateContent = (id: string, content: string, node: HTMLTextAreaElement) => {
    updateItem(id, { content });
    resizeContentTextarea(node);
  };

  const handleContentKeyDown = (
    item: ReportTaskItem,
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      if (event.shiftKey || event.altKey) return;
      event.preventDefault();
      moveToNextOrAddItem(item.id);
      return;
    }
    if (event.key === "Backspace" && item.content.length === 0) {
      event.preventDefault();
      removeEmptyItemFromContent(item.id);
    }
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
            showStatus && showAssignee && showDirectiveOwner
              ? "md:grid-cols-[28px_36px_96px_120px_132px_minmax(220px,1fr)_36px]"
              : showStatus && showAssignee
                ? "md:grid-cols-[28px_36px_96px_120px_minmax(220px,1fr)_36px]"
                : showStatus && showDirectiveOwner
                  ? "md:grid-cols-[28px_36px_96px_132px_minmax(220px,1fr)_36px]"
                  : showAssignee && showDirectiveOwner
                    ? "md:grid-cols-[28px_36px_120px_132px_minmax(220px,1fr)_36px]"
                    : showStatus
                      ? "md:grid-cols-[28px_36px_96px_minmax(220px,1fr)_36px]"
                      : showAssignee
                        ? "md:grid-cols-[28px_36px_120px_minmax(220px,1fr)_36px]"
                        : showDirectiveOwner
                          ? "md:grid-cols-[28px_36px_132px_minmax(220px,1fr)_36px]"
                          : "md:grid-cols-[28px_36px_minmax(220px,1fr)_36px]"
          )}
        >
          <span />
          <span />
          {showStatus && <span>상태</span>}
          {showAssignee && <span>담당자</span>}
          {showDirectiveOwner && <span>부서장</span>}
          <span>내용</span>
          <span />
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {items.map((item) => (
                <SortableReportTaskRow
                  key={item.id}
                  item={item}
                  important={isImportantTaskItem(item)}
                  showStatus={showStatus}
                  showAssignee={showAssignee}
                  showDirectiveOwner={showDirectiveOwner}
                  setContentRef={(id, node) => {
                    contentRefs.current[id] = node;
                  }}
                  resizeContentTextarea={resizeContentTextarea}
                  onToggleImportant={toggleImportant}
                  onStatusChange={updateStatus}
                  onAssigneeChange={updateAssigneeName}
                  onDirectiveOwnerChange={updateDirectiveOwner}
                  onContentChange={updateContent}
                  onContentKeyDown={handleContentKeyDown}
                  onRemove={removeItem}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="mt-3 flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
            className="h-9 min-w-32 border-dashed bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            aria-label={`${title} 항목 추가`}
          >
            <Plus className="h-4 w-4" />
            항목 추가
          </Button>
        </div>
      </div>
    </section>
  );
}
