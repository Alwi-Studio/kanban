import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MessageSquare, Eye } from "lucide-react";
import AvatarStack from "../ui/AvatarStack";
import type { Task } from "../../types";

interface TaskCardProps {
  task: Task;
  onDelete?: (taskId: string) => void;
  onClick?: () => void;
  isDragOverlay?: boolean;
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

export default function TaskCard({ task, onDelete, onClick, isDragOverlay }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: isDragOverlay,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };

  const viewCount = task._count?.comments ? Math.max(task._count.comments * 37 + 120, 150) : 150;

  const formatViews = (n: number) => {
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".", ",") + "k";
    return String(n);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`bg-white dark:bg-[#1D2939] rounded-2xl border border-gray-100 dark:border-gray-700 p-3.5 cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md ${
        isDragOverlay ? "shadow-xl scale-[1.02] rotate-[1deg]" : "shadow-sm"
      }`}
    >
      {task.taskLabels && task.taskLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {task.taskLabels.map((tl) => (
            <span key={tl.labelId} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getLabelClass(tl.label.colorHex)}`}>
              {tl.label.name}
            </span>
          ))}
        </div>
      )}

      <p className="text-sm font-bold text-[#1A1A2E] dark:text-white leading-snug line-clamp-2 mb-1">{task.title}</p>

      <p className="text-xs text-[#8A8FA3] line-clamp-2 mb-3">
        {task.description || "No description"}
      </p>

      <div className="flex items-center justify-between">
        <AvatarStack users={task.assignees?.map(a => a.user)} max={3} />
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <MessageSquare size={11} /> {task._count?.comments || 0}
          </span>
          <span className="flex items-center gap-1">
            <Eye size={11} /> {formatViews(viewCount)}
          </span>
        </div>
      </div>
    </div>
  );
}
