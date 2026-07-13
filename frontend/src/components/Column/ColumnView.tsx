import { useState, useRef, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, MoreHorizontal, Trash2, GripVertical } from "lucide-react";
import TaskCard from "../TaskCard/TaskCard";
import type { Column, Task } from "../../types";

const COLORS = ["#6C4EF5", "#F5A623", "#2ECC71", "#E74C3C", "#3498DB", "#9B59B6", "#1ABC9C", "#E67E22"];

interface ColumnViewProps {
  column: Column;
  colorIndex: number;
  newTaskTitle: string;
  onNewTaskTitleChange: (val: string) => void;
  onAddTask: () => void;
  onDeleteColumn: () => void;
  onDeleteTask: (taskId: string) => void;
  onTaskClick: (task: Task) => void;
  onRenameColumn: (name: string) => void;
  canEditTasks?: boolean;
  canReorderTasks?: boolean;
  canManageColumn?: boolean;
}

export default function ColumnView({
  column,
  colorIndex,
  newTaskTitle,
  onNewTaskTitleChange,
  onAddTask,
  onDeleteColumn,
  onDeleteTask,
  onTaskClick,
  onRenameColumn,
  canEditTasks = true,
  canReorderTasks = canEditTasks,
  canManageColumn = true,
}: ColumnViewProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: column.id, disabled: !canReorderTasks });
  const { attributes, listeners, setNodeRef: setDragRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: `column-${column.id}`,
    disabled: !canManageColumn,
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(column.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const skipRenameBlurRef = useRef(false);
  const colColor = COLORS[colorIndex % COLORS.length];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isRenaming) {
      renameRef.current?.focus();
      renameRef.current?.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    if (!isRenaming) setRenameValue(column.name);
  }, [column.name, isRenaming]);

  const startRenaming = () => {
    skipRenameBlurRef.current = false;
    setRenameValue(column.name);
    setIsRenaming(true);
    setMenuOpen(false);
  };

  const cancelRenaming = () => {
    skipRenameBlurRef.current = true;
    setRenameValue(column.name);
    setIsRenaming(false);
  };

  const saveRename = () => {
    const name = renameValue.trim();
    if (!name) {
      cancelRenaming();
      return;
    }
    setIsRenaming(false);
    if (name !== column.name) onRenameColumn(name);
  };

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : undefined,
  };

  return (
    <div
      ref={setDragRef}
      style={dragStyle}
      className={`w-[19rem] shrink-0 flex flex-col max-h-full rounded-2xl border p-3 transition-colors ${isOver ? "border-brand bg-brand/5 dark:bg-brand/10" : "border-gray-200 dark:border-gray-700 bg-gray-100/70 dark:bg-[#161B26]"}`}
    >
      <div
        className="flex items-center justify-between px-3.5 py-2.5 rounded-xl mb-3 shadow-sm"
        style={{ backgroundColor: colColor }}
      >
        <div className="flex items-center gap-1 min-w-0">
          {canManageColumn && <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="w-5 h-5 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white transition cursor-grab active:cursor-grabbing shrink-0"
            title="Drag to reorder"
          >
            <GripVertical size={11} />
          </button>}
          <span className="w-7 h-7 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center text-white text-xs font-bold shrink-0">
            {column.tasks.length}
          </span>
          {isRenaming ? (
            <input
              ref={renameRef}
              value={renameValue}
              onChange={event => setRenameValue(event.target.value)}
              onBlur={() => {
                if (skipRenameBlurRef.current) {
                  skipRenameBlurRef.current = false;
                  return;
                }
                saveRename();
              }}
              onPointerDown={event => event.stopPropagation()}
              onKeyDown={event => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") cancelRenaming();
              }}
              aria-label="Column name"
              className="min-w-0 w-full rounded-md bg-white/20 px-2 py-1 text-sm font-bold text-white outline-none ring-1 ring-white/50 placeholder:text-white/60"
            />
          ) : (
            <h3 className="text-sm font-bold text-white truncate" onDoubleClick={startRenaming}>{column.name}</h3>
          )}
        </div>
        <div className="flex items-center gap-1">
          {canEditTasks && <button
            onClick={onAddTask}
            className="w-6 h-6 rounded-full bg-white/30 hover:bg-white/50 backdrop-blur-sm flex items-center justify-center text-white transition"
            title="Add task"
          >
            <Plus size={14} />
          </button>}
          {canManageColumn && <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(!menuOpen)} className="w-6 h-6 rounded-full bg-white/30 hover:bg-white/50 backdrop-blur-sm flex items-center justify-center text-white transition">
              <MoreHorizontal size={12} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[120px] z-20 animate-scale-in">
                <button onClick={startRenaming} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Rename</button>
                <button onClick={() => { onDeleteColumn(); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            )}
          </div>}
        </div>
      </div>

      <div ref={setDropRef} className="flex-1 min-h-[72px] space-y-2.5 overflow-y-auto scrollbar-thin px-0.5">
        <SortableContext items={column.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {column.tasks.map((task) => (
            <TaskCard key={task.id} task={task} onDelete={canEditTasks ? onDeleteTask : undefined} onClick={() => onTaskClick(task)} disabled={!canReorderTasks} />
          ))}
        </SortableContext>
        {column.tasks.length === 0 && (
          <div className="text-gray-300 dark:text-gray-500 text-xs text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
            Drop tasks here
          </div>
        )}
      </div>

      {canEditTasks && <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white dark:hover:bg-gray-800 transition-colors focus-within:bg-white dark:focus-within:bg-gray-800 focus-within:ring-2 focus-within:ring-brand/20">
          <Plus size={14} className="text-gray-400 shrink-0" />
          <input
            value={newTaskTitle}
            onChange={(e) => onNewTaskTitleChange(e.target.value)}
            placeholder="Add a task…"
            aria-label={`Add task to ${column.name}`}
            className="w-full bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none"
            onKeyDown={(e) => e.key === "Enter" && onAddTask()}
          />
        </div>
      </div>}
    </div>
  );
}
