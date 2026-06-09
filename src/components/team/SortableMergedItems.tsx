"use client";

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
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MergedItem } from "@/types";

function SortableItem({
  item,
  selected,
  onSelect,
}: {
  item: MergedItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3",
        selected ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white"
      )}
    >
      <button {...attributes} {...listeners} className="mt-0.5 cursor-grab text-slate-400">
        <GripVertical className="h-4 w-4" />
      </button>
      <button type="button" className="flex-1 text-left text-sm" onClick={onSelect}>
        {item.content}
      </button>
    </div>
  );
}

interface SortableMergedItemsProps {
  items: MergedItem[];
  selectedIds: Set<string>;
  onReorder: (items: MergedItem[]) => void;
  onSelect: (id: string) => void;
}

export function SortableMergedItems({
  items,
  selectedIds,
  onReorder,
  onSelect,
}: SortableMergedItemsProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({
      ...item,
      order: idx,
    }));
    onReorder(reordered);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map((item) => (
            <SortableItem
              key={item.id}
              item={item}
              selected={selectedIds.has(item.id)}
              onSelect={() => onSelect(item.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
