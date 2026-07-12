import { useState, useEffect, useRef, useMemo } from "react";
import { X, Calendar, Paperclip, MessageSquare, UserPlus, Image, FileText, File, Search } from "lucide-react";
import type { Task, Comment, Attachment, Board, Label } from "../../types";
import { getComments, addComment, getAttachments, uploadAttachment, addAssignee, removeAssignee, addLabelToTask, removeLabelFromTask, updateTask } from "../../services/board";
import { API_BASE } from "../../services/api";
import Badge from "../ui/Badge";
import AvatarStack from "../ui/AvatarStack";

interface TaskModalProps {
  task: Task;
  board: Board;
  onClose: () => void;
  onUpdate: (task: Task) => void;
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function attachmentIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext || "")) return Image;
  if (["pdf"].includes(ext || "")) return FileText;
  if (["doc", "docx", "txt", "md"].includes(ext || "")) return FileText;
  return File;
}

const colors = ["#6C4EF5", "#2ECC71", "#F5A623", "#E74C3C", "#8B5CF6", "#EC4899", "#3498DB", "#1ABC9C"];

function hashCode(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export default function TaskModal({ task, board, onClose, onUpdate }: TaskModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [dueDate, setDueDate] = useState(task.dueDate?.split("T")[0] || "");
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [labelSearch, setLabelSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const memberRef = useRef<HTMLDivElement>(null);

  const boardLabels = board.labels || [];
  const boardMembers = board.members || [];

  useEffect(() => {
    getComments(task.id).then(setComments).catch(() => {});
    getAttachments(task.id).then(setAttachments).catch(() => {});
  }, [task.id]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (labelRef.current && !labelRef.current.contains(e.target as Node)) { setShowLabelPicker(false); setLabelSearch(""); }
      if (memberRef.current && !memberRef.current.contains(e.target as Node)) { setShowMemberPicker(false); setMemberSearch(""); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSave = async () => {
    const updated = await updateTask(task.id, {
      title,
      description: description || undefined,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      version: task.version,
    });
    onUpdate(updated);
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    const c = await addComment(task.id, newComment);
    setComments(prev => [...prev, c]);
    setNewComment("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const a = await uploadAttachment(task.id, file);
      setAttachments(prev => [a, ...prev]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleAddLabel = async (labelId: string) => {
    await addLabelToTask(task.id, labelId);
    onUpdate({ ...task, taskLabels: [...task.taskLabels, { taskId: task.id, labelId, label: boardLabels.find(l => l.id === labelId)! }] });
    setShowLabelPicker(false);
  };

  const handleRemoveLabel = async (labelId: string) => {
    await removeLabelFromTask(task.id, labelId);
    onUpdate({ ...task, taskLabels: task.taskLabels.filter(tl => tl.labelId !== labelId) });
  };

  const handleAddAssignee = async (userId: string, user: { id: string; name: string; email: string }) => {
    await addAssignee(task.id, userId);
    onUpdate({ ...task, assignees: [...task.assignees, { id: "", taskId: task.id, userId, user }] });
    setShowMemberPicker(false);
  };

  const handleRemoveAssignee = async (userId: string) => {
    await removeAssignee(task.id, userId);
    onUpdate({ ...task, assignees: task.assignees.filter(a => a.userId !== userId) });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 pb-12">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-surface-dark rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto z-10 shadow-2xl border border-gray-200 dark:border-gray-700 animate-scale-in">
        <div className="sticky top-0 bg-white dark:bg-surface-dark px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between rounded-t-2xl z-10">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleSave}
            className="bg-transparent text-lg font-semibold text-gray-900 dark:text-white flex-1 outline-none"
          />
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-400" />
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                onBlur={handleSave}
                className="text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#6C4EF5]/30"
              />
            </div>

            <div className="relative" ref={memberRef}>
              <button onClick={() => { setShowMemberPicker(!showMemberPicker); setMemberSearch(""); }} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                <UserPlus size={14} /> Assign
              </button>
              {showMemberPicker && (
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg w-56 z-20 p-2 max-h-56 overflow-y-auto">
                  <div className="relative mb-2">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      placeholder="Search members..."
                      className="w-full pl-7 pr-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 outline-none focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                  {boardMembers.filter(m => !task.assignees.some(a => a.userId === m.userId)).filter(m => m.user.name.toLowerCase().includes(memberSearch.toLowerCase())).map(m => (
                    <button key={m.userId} onClick={() => handleAddAssignee(m.userId, m.user)} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-medium" style={{ backgroundColor: colors[hashCode(m.user.id) % colors.length] }}>{m.user.name.charAt(0)}</div>
                      {m.user.name}
                    </button>
                  ))}
                  {boardMembers.filter(m => !task.assignees.some(a => a.userId === m.userId)).filter(m => m.user.name.toLowerCase().includes(memberSearch.toLowerCase())).length === 0 && <p className="text-xs text-gray-400 text-center py-2">No members found</p>}
                </div>
              )}
            </div>

            <div className="relative" ref={labelRef}>
              <button onClick={() => { setShowLabelPicker(!showLabelPicker); setLabelSearch(""); }} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition">+ Label</button>
              {showLabelPicker && (
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg w-48 z-20 p-2 max-h-56 overflow-y-auto">
                  <div className="relative mb-2">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={labelSearch}
                      onChange={e => setLabelSearch(e.target.value)}
                      placeholder="Search labels..."
                      className="w-full pl-7 pr-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 outline-none focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                  {boardLabels.filter(l => !task.taskLabels.some(tl => tl.labelId === l.id)).filter(l => l.name.toLowerCase().includes(labelSearch.toLowerCase())).map(l => (
                    <button key={l.id} onClick={() => handleAddLabel(l.id)} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-sm" style={{ color: l.colorHex }}>
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: l.colorHex }} />
                      {l.name}
                    </button>
                  ))}
                  {boardLabels.filter(l => !task.taskLabels.some(tl => tl.labelId === l.id)).filter(l => l.name.toLowerCase().includes(labelSearch.toLowerCase())).length === 0 && <p className="text-xs text-gray-400 text-center py-2">No labels found</p>}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {task.taskLabels.map(tl => {
              const Icon = attachmentIcon(tl.label.name);
              return (
                <span key={tl.labelId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs cursor-pointer" style={{ backgroundColor: tl.label.colorHex + "18", color: tl.label.colorHex }} onClick={() => handleRemoveLabel(tl.labelId)} title="Remove label">
                  {tl.label.name}
                  <X size={10} />
                </span>
              );
            })}
          </div>

          {task.assignees.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Assignees:</span>
              <div className="flex items-center gap-1">
                {task.assignees.map(a => (
                  <span key={a.userId} className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-full pl-1 pr-2 py-0.5 text-xs">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-medium" style={{ backgroundColor: colors[hashCode(a.user.id) % colors.length] }}>{a.user.name.charAt(0)}</div>
                    {a.user.name}
                    <button onClick={() => handleRemoveAssignee(a.userId)} className="text-gray-400 hover:text-red-500 ml-0.5"><X size={10} /></button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              onBlur={handleSave}
              placeholder="Add a description..."
              rows={3}
              className="input resize-y"
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Paperclip size={14} className="text-gray-400" />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Attachments ({attachments.length})</span>
            </div>
            <div className="space-y-2">
              {attachments.map(a => {
                const Icon = attachmentIcon(a.fileName);
                return (
                  <div key={a.id} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 py-3 border border-gray-100 dark:border-gray-700">
                    <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center text-brand shrink-0">
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{a.fileName}</p>
                      <p className="text-xs text-gray-400">{formatSize(a.fileSize)}</p>
                    </div>
                    <a href={a.fileUrl.startsWith("http") ? a.fileUrl : `${API_BASE}${a.fileUrl}`} target="_blank" rel="noreferrer" className="text-brand text-xs hover:underline font-medium">View</a>
                  </div>
                );
              })}
              {attachments.length === 0 && <p className="text-xs text-gray-400">No attachments</p>}
            </div>
            <input ref={fileRef} type="file" onChange={handleFileUpload} className="hidden" />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-3 text-sm text-brand hover:text-brand-600 transition font-medium">{uploading ? "Uploading..." : "+ Add attachment"}</button>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={14} className="text-gray-400" />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Comments ({comments.length})</span>
            </div>
            <div className="space-y-3 max-h-48 overflow-y-auto mb-3">
              {comments.map(c => {
                const colorIdx = hashCode(c.user.id) % colors.length;
                return (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-medium mt-0.5" style={{ backgroundColor: colors[colorIdx] }}>{c.user.name.charAt(0)}</div>
                    <div className="flex-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 py-2.5">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.user.name}</span>
                        <span className="text-xs text-gray-400">{relativeTime(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{c.content}</p>
                    </div>
                  </div>
                );
              })}
              {comments.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No comments yet</p>}
            </div>
            <div className="flex gap-2">
              <input
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="input flex-1"
                onKeyDown={e => e.key === "Enter" && handleAddComment()}
              />
              <button onClick={handleAddComment} className="btn-primary shrink-0">Send</button>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-surface-dark px-6 py-4 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary px-5">Cancel</button>
          <button onClick={handleSave} className="btn-primary px-5">Save Task</button>
        </div>
      </div>
    </div>
  );
}
