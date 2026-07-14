import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, MessageSquare, Paperclip, Trash2, Plus } from "lucide-react";
import AvatarStack from "../ui/AvatarStack";
import type { Task, Label } from "../../types";

interface TaskCardProps {
  task: Task;
  onDelete?: (taskId: string) => void;
  onClick?: () => void;
  labels?: Label[];
  onAddLabel?: (task: Task, labelId: string) => void;
  isDragOverlay?: boolean;
  disabled?: boolean;
}

const labelColors: Record<string, string> = {
  purple: "bg-purple-100 text-purple-700",
  orange: "bg-orange-100 text-orange-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red: "bg-red-100 text-red-600",
  green: "bg-green-100 text-green-700",
  peach: "bg-orange-50 text-orange-600",
  gray: "bg-gray-100 text-gray-600",
  pink: "bg-pink-100 text-pink-600",
};

function getLabelClass(colorHex: string) {
  const hex = colorHex.toLowerCase();
  if (hex.includes("purple") || hex === "#8b5cf6" || hex === "#6c4ef5") return labelColors.purple;
  if (hex.includes("orange") || hex === "#f5a623") return labelColors.orange;
  if (hex.includes("yellow") || hex === "#f79009") return labelColors.yellow;
  if (hex.includes("red") || hex === "#f04438" || hex === "#e74c3c") return labelColors.red;
  if (hex.includes("green") || hex === "#2ecc71" || hex === "#12b76a") return labelColors.green;
  if (hex.includes("pink") || hex === "#ec4899") return labelColors.pink;
  if (hex.includes("gray") || hex.includes("grey") || hex === "#98a2b3") return labelColors.gray;
  return labelColors.peach;
}

export default function TaskCard({ task, onDelete, onClick, labels, onAddLabel, isDragOverlay, disabled = false }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: isDragOverlay || disabled,
  });
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const labelPickerRef = useRef<HTMLDivElement>(null);
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();
  const availableLabels = (labels || []).filter(l => !task.taskLabels.some(tl => tl.labelId === l.id));
  const canQuickLabel = !isDragOverlay && !!onAddLabel && availableLabels.length > 0;

  useEffect(() => {
    if (!showLabelPicker) return;
    const handler = (event: MouseEvent) => {
      if (labelPickerRef.current && !labelPickerRef.current.contains(event.target as Node)) setShowLabelPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showLabelPicker]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate ? dueDate.getTime() < Date.now() : false;
  const isDueSoon = dueDate ? !isOverdue && dueDate.getTime() - Date.now() < 3 * 86400000 : false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      onKeyDown={event => { if ((event.key === "Enter" || event.key === " ") && onClick) { event.preventDefault(); onClick(); } }}
      role="button"
      tabIndex={0}
      className={`group relative bg-white dark:bg-[#1D2939] rounded-xl border border-gray-200/80 dark:border-gray-700 p-3.5 ${disabled ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"} transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md focus-visible:border-brand ${
        isDragOverlay ? "shadow-xl scale-[1.02] rotate-[1deg]" : "shadow-sm"
      }`}
    >
      {onDelete && !isDragOverlay && (
        <button
          onPointerDown={event => event.stopPropagation()}
          onClick={event => { event.stopPropagation(); onDelete(task.id); }}
          className="absolute right-2 top-2 z-10 rounded-lg bg-white/90 dark:bg-gray-800 p-1.5 text-gray-300 opacity-0 shadow-sm transition hover:text-red-500 group-hover:opacity-100 focus:opacity-100"
          aria-label={`Delete ${task.title}`}
          title="Delete task"
        >
          <Trash2 size={12} />
        </button>
      )}
      {(task.taskLabels?.length > 0 || canQuickLabel) && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {task.taskLabels.map((tl) => (
            <span key={tl.labelId} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getLabelClass(tl.label.colorHex)}`}>
              {tl.label.name}
            </span>
          ))}
          {canQuickLabel && (
            <div className="relative" ref={labelPickerRef}>
              <button
                onPointerDown={stop}
                onClick={event => { stop(event); setShowLabelPicker(prev => !prev); }}
                className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 hover:text-brand hover:border-brand transition ${showLabelPicker ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"}`}
                aria-label="Add label"
                title="Add label"
              >
                <Plus size={10} /> Label
              </button>
              {showLabelPicker && (
                <div onPointerDown={stop} onClick={stop} className="absolute left-0 top-full mt-1 z-20 w-44 max-h-48 overflow-y-auto bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg p-1.5">
                  {availableLabels.map(l => (
                    <button
                      key={l.id}
                      onPointerDown={stop}
                      onClick={event => { stop(event); onAddLabel!(task, l.id); setShowLabelPicker(false); }}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 text-left"
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: l.colorHex }} />
                      <span className="truncate">{l.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2 mb-1 pr-4">{task.title}</p>

      {task.description && <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">{task.description}</p>}

      {dueDate && <div className={`mb-3 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium ${isOverdue ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" : isDueSoon ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300"}`}>
        <CalendarDays size={11} />
        {isOverdue ? "Overdue · " : ""}{dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </div>}

      <div className="flex items-center justify-between">
        <AvatarStack users={task.assignees?.map(a => a.user)} max={3} />
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <MessageSquare size={11} /> {task._count?.comments || 0}
          </span>
          <span className="flex items-center gap-1">
            <Paperclip size={11} /> {task._count?.attachments || 0}
          </span>
        </div>
      </div>
    </div>
  );
}
