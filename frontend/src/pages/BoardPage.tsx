import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, Filter, List, ListTodo, X, Users, Tag, Share2, Search, Upload, ArrowUpDown, Eye, MessageSquare } from "lucide-react";
import { useBoardStore } from "../store/boardStore";
import { getBoard, createColumn, deleteColumn, updateColumn, updateTask, createTask, deleteTask, createLabel, deleteLabel, getActivityLogs, inviteMember, updateMemberRole, removeMember, updateBoard, deleteBoard } from "../services/board";
import { connectSocket, joinBoard, leaveBoard } from "../services/socket";
import { useToast } from "../components/ui/Toast";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import ColumnView from "../components/Column/ColumnView";
import TaskCard from "../components/TaskCard/TaskCard";
import TaskModal from "../components/TaskModal/TaskModal";
import Topbar from "../components/Layout/Topbar";
import type { Task, Column, Label, ActivityLog, BoardMember } from "../types";

const tabs = [
  { label: "By Status", key: "status" },
  { label: "By Total Tasks", key: "total" },
  { label: "Tasks Due", key: "due" },
  { label: "Extra Tasks", key: "extra" },
  { label: "Tasks Completed", key: "completed" },
];

export default function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    currentBoard: board, setCurrentBoard, moveTask, updateTaskInState, removeTaskFromState, addTaskToState,
    updateColumnInState, removeColumnFromState, addColumnToState,
    addLabelToBoard, removeLabelFromBoard,
    addMemberToBoard, updateMemberInBoard, removeMemberFromBoard,
  } = useBoardStore();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskColId, setNewTaskColId] = useState("");
  const [newTaskTitleInput, setNewTaskTitleInput] = useState("");
  const [newColName, setNewColName] = useState("");
  const [showNewCol, setShowNewCol] = useState(false);
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#6C4EF5");
  const [newTaskTitles, setNewTaskTitles] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [filterLabel, setFilterLabel] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [activeTab, setActiveTab] = useState("status");
  const [sortBy, setSortBy] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [showSearchInput, setShowSearchInput] = useState(false);

  const [editingBoard, setEditingBoard] = useState(false);
  const [boardNameValue, setBoardNameValue] = useState("");
  const boardNameRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void; variant?: "danger" | "brand" } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const fetchBoard = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    getBoard(id)
      .then(data => setCurrentBoard(data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id, navigate, setCurrentBoard]);

  useEffect(() => { fetchBoard(); }, [fetchBoard]);

  useEffect(() => {
    if (editingBoard && boardNameRef.current) {
      boardNameRef.current.focus();
      boardNameRef.current.select();
    }
  }, [editingBoard]);

  useEffect(() => {
    if (showSearchInput && searchRef.current) searchRef.current.focus();
  }, [showSearchInput]);

  useEffect(() => {
    if (!id) return;
    const socket = connectSocket();
    joinBoard(id);

    const hTaskUpdated = (task: Task) => updateTaskInState(task);
    const hTaskDeleted = ({ id: tid }: { id: string }) => removeTaskFromState(tid);
    const hTaskCreated = (task: Task) => addTaskToState(task);
    const hColumnCreated = (col: Column) => addColumnToState(col);
    const hColumnUpdated = (col: Column) => updateColumnInState(col);
    const hColumnDeleted = ({ id: cid }: { id: string }) => removeColumnFromState(cid);
    const hLabelCreated = (label: Label) => addLabelToBoard(label);
    const hLabelDeleted = ({ id: lid }: { id: string }) => removeLabelFromBoard(lid);
    const hMemberAdded = (member: BoardMember) => addMemberToBoard(member);
    const hMemberUpdated = (member: BoardMember) => updateMemberInBoard(member);
    const hMemberRemoved = ({ userId }: { userId: string }) => removeMemberFromBoard(userId);

    socket.on("task:updated", hTaskUpdated);
    socket.on("task:deleted", hTaskDeleted);
    socket.on("task:created", hTaskCreated);
    socket.on("column:created", hColumnCreated);
    socket.on("column:updated", hColumnUpdated);
    socket.on("column:deleted", hColumnDeleted);
    socket.on("label:created", hLabelCreated);
    socket.on("label:deleted", hLabelDeleted);
    socket.on("member:added", hMemberAdded);
    socket.on("member:updated", hMemberUpdated);
    socket.on("member:removed", hMemberRemoved);

    return () => {
      leaveBoard(id);
      socket.off("task:updated", hTaskUpdated);
      socket.off("task:deleted", hTaskDeleted);
      socket.off("task:created", hTaskCreated);
      socket.off("column:created", hColumnCreated);
      socket.off("column:updated", hColumnUpdated);
      socket.off("column:deleted", hColumnDeleted);
      socket.off("label:created", hLabelCreated);
      socket.off("label:deleted", hLabelDeleted);
      socket.off("member:added", hMemberAdded);
      socket.off("member:updated", hMemberUpdated);
      socket.off("member:removed", hMemberRemoved);
    };
  }, [id, updateTaskInState, removeTaskFromState, addTaskToState, addColumnToState, updateColumnInState, removeColumnFromState, addLabelToBoard, removeLabelFromBoard, addMemberToBoard, updateMemberInBoard, removeMemberFromBoard]);

  const filteredTasks = useCallback((col: Column) => {
    let tasks = col.tasks;
    if (search) tasks = tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));
    if (filterLabel) tasks = tasks.filter(t => t.taskLabels.some(tl => tl.labelId === filterLabel));
    if (filterAssignee) tasks = tasks.filter(t => t.assignees.some(a => a.userId === filterAssignee));

    if (activeTab === "due") tasks = tasks.filter(t => t.dueDate);
    if (activeTab === "completed") tasks = tasks.filter(t => col.name.toLowerCase() === "done");

    if (sortBy === "oldest") tasks = [...tasks].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    else tasks = [...tasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return tasks;
  }, [search, filterLabel, filterAssignee, activeTab, sortBy]);

  const hasActiveFilters = search || filterLabel || filterAssignee || activeTab !== "status";

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string;
    if (activeId.startsWith("column-")) return;
    for (const col of board?.columns || []) {
      const found = col.tasks.find(t => t.id === activeId);
      if (found) { setActiveTask(found); break; }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || !board) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId.startsWith("column-")) {
      const colId = activeId.replace("column-", "");
      const targetId = overId.startsWith("column-") ? overId.replace("column-", "") : overId;
      if (colId === targetId) return;
      const cols = board.columns;
      const fromIdx = cols.findIndex(c => c.id === colId);
      const toIdx = cols.findIndex(c => c.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return;
      const reordered = [...cols];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      const updated = reordered.map((c, i) => ({ ...c, position: i }));
      setCurrentBoard({ ...board, columns: updated });
      updateColumn(colId, { position: toIdx }).catch(() => fetchBoard());
      return;
    }

    let sourceCol: Column | undefined, task: Task | undefined, targetCol: Column | undefined;
    for (const col of board.columns) {
      const found = col.tasks.find(t => t.id === activeId);
      if (found) { sourceCol = col; task = found; }
      if (col.id === overId) targetCol = col;
      if (col.tasks.some(t => t.id === overId)) targetCol = col;
    }
    if (!task || !sourceCol || !targetCol) return;
    const targetTasks = targetCol.tasks.filter(t => t.id !== activeId);
    let newPosition: number;
    if (targetCol.id === overId) {
      newPosition = targetTasks.length ? Math.max(...targetTasks.map(t => t.position)) + 1 : 0;
    } else {
      const idx = targetTasks.findIndex(t => t.id === overId);
      if (idx === -1) newPosition = targetTasks.length ? Math.max(...targetTasks.map(t => t.position)) + 1 : 0;
      else if (idx === 0) newPosition = targetTasks.length ? targetTasks[0].position - 1 : 0;
      else newPosition = (targetTasks[idx - 1].position + targetTasks[idx].position) / 2;
    }
    moveTask(activeId, sourceCol.id, targetCol.id, newPosition, task.version + 1);
    updateTask(activeId, { column_id: targetCol.id, position: newPosition, version: task.version })
      .then(() => toast("Task moved", "success"))
      .catch(err => { if (err.response?.status === 409) fetchBoard(); });
  };

  const loadLogs = useCallback(async () => {
    if (!id) return;
    try { setLogs(await getActivityLogs(id)); } catch {}
  }, [id]);

  useEffect(() => { if (showLog) loadLogs(); }, [showLog, loadLogs]);

  const confirmThen = (title: string, message: string, action: () => Promise<void>, successMsg: string) => {
    setConfirm({
      title, message, variant: "danger",
      onConfirm: async () => {
        setConfirm(null);
        try { await action(); toast(successMsg, "success"); } catch { toast("Action failed", "error"); }
      },
    });
  };

  const handleAddColumn = async () => {
    if (!newColName.trim() || !id) return;
    await createColumn(id, newColName);
    setNewColName(""); setShowNewCol(false);
    toast(`Column "${newColName}" created`, "success");
  };

  const handleDeleteColumn = (colId: string, colName: string) => {
    confirmThen("Delete column", `Delete "${colName}" and all its tasks?`, () => deleteColumn(colId), `Column "${colName}" deleted`);
  };

  const handleRenameColumn = async (colId: string, name: string) => {
    try {
      const updated = await updateColumn(colId, { name });
      updateColumnInState(updated);
      toast(`Column renamed`, "success");
    } catch { toast("Failed to rename column", "error"); }
  };

  const handleAddTask = async (colId: string, customTitle?: string) => {
    const title = customTitle || newTaskTitles[colId]?.trim();
    if (!title) return;
    const task = await createTask(colId, title);
    addTaskToState(task);
    setNewTaskTitles(p => ({ ...p, [colId]: "" }));
    toast(`Task created`, "success");
  };

  const handleDeleteTask = (taskId: string, title: string) => {
    confirmThen("Delete task", `Delete "${title}"?`, () => deleteTask(taskId), `Task deleted`);
  };

  const handleAddLabel = async () => {
    if (!newLabelName.trim() || !id) return;
    const label = await createLabel(id, newLabelName, newLabelColor);
    addLabelToBoard(label);
    setNewLabelName(""); setShowNewLabel(false);
    toast(`Label created`, "success");
  };

  const handleDeleteLabel = (labelId: string, labelName: string) => {
    confirmThen("Delete label", `Delete "${labelName}"?`, () => deleteLabel(id!, labelId), `Label deleted`);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !id) return;
    try {
      await inviteMember(id, inviteEmail);
      setInviteEmail("");
      toast("Member invited", "success");
    } catch { toast("Failed to invite member", "error"); }
  };

  const handleUpdateMemberRole = async (userId: string, role: string) => {
    try {
      const updated = await updateMemberRole(id!, userId, role);
      updateMemberInBoard(updated);
      toast("Member role updated", "success");
    } catch { toast("Failed to update role", "error"); }
  };

  const handleRemoveMember = (userId: string, userName: string) => {
    confirmThen("Remove member", `Remove "${userName}"?`, () => removeMember(id!, userId), `Member removed`);
  };

  const handleSaveBoardName = async () => {
    if (!boardNameValue.trim() || !id) return;
    try {
      const updated = await updateBoard(id, boardNameValue.trim());
      setCurrentBoard({ ...board!, name: updated.name });
      setEditingBoard(false);
      toast("Board renamed", "success");
    } catch { toast("Failed to rename board", "error"); }
  };

  const handleDeleteBoardAction = () => {
    confirmThen("Delete board", `Delete "${board?.name}"? This cannot be undone.`, async () => {
      await deleteBoard(id!);
      navigate("/");
    }, `Board deleted`);
  };

  if (loading) return (
    <div className="flex h-screen bg-bg-page">
      <div className="flex-1 p-6 animate-pulse">
        <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded-full mb-6" />
        <div className="flex gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-72 rounded-2xl bg-gray-100 dark:bg-gray-800/50 p-3 space-y-2.5">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
              {[1, 2].map(j => <div key={j} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-2xl" />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (notFound) return (
    <div className="flex h-screen bg-bg-page items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <ListTodo size={28} className="text-gray-400" />
        </div>
        <p className="text-gray-500">Board not found</p>
        <button onClick={() => navigate("/")} className="btn-primary text-xs">Back to Dashboard</button>
      </div>
    </div>
  );

  if (!board) return null;

  const totalTasks = board.columns.reduce((s, c) => s + c.tasks.length, 0);

  return (
    <div className="flex h-screen bg-bg-page">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-surface-dark">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                {editingBoard ? (
                  <div className="flex items-center gap-1">
                    <input
                      ref={boardNameRef}
                      value={boardNameValue}
                      onChange={e => setBoardNameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleSaveBoardName(); if (e.key === "Escape") { setEditingBoard(false); setBoardNameValue(board.name); } }}
                      onBlur={handleSaveBoardName}
                      className="text-lg font-bold bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full px-3 py-1 outline-none text-[#1A1A2E] dark:text-white"
                    />
                  </div>
                ) : (
                  <h1 className="text-lg font-bold text-[#1A1A2E] dark:text-white" onDoubleClick={() => { setEditingBoard(true); setBoardNameValue(board.name); }}>
                    {board.name}
                  </h1>
                )}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                  <button onClick={() => { setEditingBoard(true); setBoardNameValue(board.name); }} className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-[#6C4EF5] hover:bg-[#6C4EF5]/10 transition" title="Rename">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  </button>
                  <button onClick={handleDeleteBoardAction} className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition" title="Delete">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <button onClick={() => navigate("/")} className="text-[11px] text-gray-400 hover:text-[#6C4EF5] transition">Home</button>
                <span className="text-gray-300 dark:text-gray-600 text-[11px]">/</span>
                <span className="text-[11px] text-gray-600 dark:text-gray-300 font-medium">{board.name}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Topbar />
          </div>
        </div>

        <div className="px-6 pt-4 pb-2 bg-white dark:bg-surface-dark border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {board.members?.slice(0, 4).map((m, i) => (
                <div key={m.id} className="w-6 h-6 rounded-full bg-[#6C4EF5] flex items-center justify-center text-white text-[9px] font-medium -ml-1 first:ml-0 border-2 border-white dark:border-surface-dark" style={{ zIndex: 4 - i }}>
                  {m.user.name.charAt(0)}
                </div>
              ))}
              {(board.members?.length || 0) > 4 && (
                <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[9px] text-gray-500 font-medium -ml-1 border-2 border-white dark:border-surface-dark">
                  +{board.members!.length - 4}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {showSearchInput ? (
                <div className="relative">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search tasks..."
                    className="pl-8 pr-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs outline-none focus:ring-2 focus:ring-[#6C4EF5]/20 w-44"
                    onBlur={() => { if (!search) setShowSearchInput(false); }}
                    onKeyDown={e => e.key === "Escape" && setShowSearchInput(false)}
                  />
                </div>
              ) : (
                <button onClick={() => setShowSearchInput(true)} className="p-1.5 rounded-full text-gray-400 hover:text-[#6C4EF5] hover:bg-[#6C4EF5]/10 transition" title="Search">
                  <Search size={14} />
                </button>
              )}
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#6C4EF5] text-white text-xs font-medium hover:bg-[#5A3FD6] transition">
                <Share2 size={12} /> Share
              </button>
              <button className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition" title="Export">
                <Upload size={14} />
              </button>
              <div className="relative">
                <button onClick={() => { setShowNewTask(true); setNewTaskColId(board.columns[0]?.id || ""); setNewTaskTitleInput(""); }} className="w-7 h-7 rounded-full bg-[#6C4EF5] text-white flex items-center justify-center hover:bg-[#5A3FD6] transition shadow-sm" title="New Task">
                  <Plus size={14} />
                </button>
                {showNewTask && (
                  <div className="absolute right-0 top-full mt-1.5 bg-white dark:bg-[#1D2939] rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg w-64 z-20 p-3 animate-scale-in">
                    <input
                      value={newTaskTitleInput}
                      onChange={e => setNewTaskTitleInput(e.target.value)}
                      placeholder="Task title..."
                      className="input text-sm mb-2"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === "Enter" && newTaskTitleInput.trim() && newTaskColId) {
                          handleAddTask(newTaskColId, newTaskTitleInput.trim());
                          setShowNewTask(false);
                        }
                        if (e.key === "Escape") setShowNewTask(false);
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <select value={newTaskColId} onChange={e => setNewTaskColId(e.target.value)} className="flex-1 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs outline-none text-gray-600 dark:text-gray-400">
                        {board.columns.map(col => <option key={col.id} value={col.id}>{col.name}</option>)}
                      </select>
                      <button onClick={() => { if (newTaskTitleInput.trim() && newTaskColId) { handleAddTask(newTaskColId, newTaskTitleInput.trim()); setShowNewTask(false); } }} className="btn-primary text-xs px-3 py-1.5">Add</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    activeTab === tab.key
                      ? "bg-[#6C4EF5]/10 text-[#6C4EF5]"
                      : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {tab.label}
                  {tab.key === "total" && <span className="ml-1 text-[10px] opacity-60">({totalTasks})</span>}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowFilters(!showFilters)} className={`p-1.5 rounded-full text-xs transition ${hasActiveFilters ? "text-[#6C4EF5] bg-[#6C4EF5]/10" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`} title="Filters">
                <Filter size={14} />
              </button>
              <button onClick={() => setShowLog(!showLog)} className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition" title="Activity Log">
                <List size={14} />
              </button>
              <button onClick={() => setShowMembers(!showMembers)} className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition" title="Members">
                <Users size={14} />
              </button>
              <button onClick={() => setShowNewLabel(!showNewLabel)} className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition" title="Labels">
                <Tag size={14} />
              </button>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="text-xs bg-gray-100 dark:bg-gray-800 rounded-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-600 outline-none text-gray-500 dark:text-gray-400"
              >
                <option value="newest">Sort By: Newest</option>
                <option value="oldest">Sort By: Oldest</option>
              </select>
            </div>
          </div>

          {showFilters && (
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <select value={filterLabel} onChange={e => setFilterLabel(e.target.value)} className="rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs outline-none text-gray-500">
                <option value="">All labels</option>
                {board.labels?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className="rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs outline-none text-gray-500">
                <option value="">All members</option>
                {board.members?.map(m => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}
              </select>
              {hasActiveFilters && <button onClick={() => { setSearch(""); setFilterLabel(""); setFilterAssignee(""); setActiveTab("status"); }} className="text-red-500 text-xs font-medium hover:underline">Clear</button>}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-x-auto scrollbar-thin p-6">
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <SortableContext items={board.columns.map(c => `column-${c.id}`)} strategy={horizontalListSortingStrategy}>
              <div className="flex gap-4 h-full items-start">
                {board.columns.length === 0 && !showNewCol && (
                  <div className="flex flex-col items-center justify-center w-full h-48 gap-2 text-gray-400">
                    <ListTodo size={28} className="text-gray-300 dark:text-gray-600" />
                    <p className="text-sm">No columns yet</p>
                    <button onClick={() => setShowNewCol(true)} className="btn-primary text-xs">Create your first column</button>
                  </div>
                )}
                {board.columns.map((col, idx) => (
                  <ColumnView
                    key={col.id}
                    column={{ ...col, tasks: filteredTasks(col) }}
                    colorIndex={idx}
                    newTaskTitle={newTaskTitles[col.id] || ""}
                    onNewTaskTitleChange={val => setNewTaskTitles(p => ({ ...p, [col.id]: val }))}
                    onAddTask={() => handleAddTask(col.id)}
                    onDeleteColumn={() => handleDeleteColumn(col.id, col.name)}
                    onDeleteTask={(taskId) => {
                      const t = col.tasks.find(ts => ts.id === taskId);
                      if (t) handleDeleteTask(taskId, t.title);
                    }}
                    onTaskClick={task => setSelectedTask(task)}
                    onRenameColumn={(name) => handleRenameColumn(col.id, name)}
                  />
                ))}
                {!showNewCol && (
                  <button onClick={() => setShowNewCol(true)} className="card p-3 w-72 shrink-0 self-start flex items-center justify-center gap-2 text-gray-400 hover:text-[#6C4EF5] hover:border-[#6C4EF5]/30 border-2 border-dashed border-gray-300 dark:border-gray-600 transition-all duration-200 min-h-[80px] rounded-2xl">
                    <Plus size={16} />
                    <span className="text-sm font-medium">Add Column</span>
                  </button>
                )}
                {showNewCol && (
                  <div className="card p-4 w-72 shrink-0 self-start border-2 border-dashed border-[#6C4EF5]/30 bg-[#6C4EF5]/5">
                    <h3 className="text-xs font-semibold text-[#6C4EF5] mb-3">Add Column</h3>
                    <input value={newColName} onChange={e => setNewColName(e.target.value)} placeholder="Column name" className="input text-sm mb-2" autoFocus onKeyDown={e => e.key === 'Enter' && handleAddColumn()} />
                    <div className="flex gap-2">
                      <button onClick={handleAddColumn} className="btn-primary text-xs flex-1">Create</button>
                      <button onClick={() => { setShowNewCol(false); setNewColName(""); }} className="btn-secondary text-xs">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </SortableContext>
            <DragOverlay>{activeTask ? <TaskCard task={activeTask} isDragOverlay /> : null}</DragOverlay>
          </DndContext>
        </div>
      </div>

      {showLog && (
        <div className="fixed right-4 top-24 bottom-4 w-80 bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl z-40 p-4 overflow-y-auto animate-slide-right">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <List size={14} className="text-gray-400" />
              <h3 className="text-sm font-semibold">Activity Log</h3>
            </div>
            <button onClick={() => setShowLog(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition"><X size={14} /></button>
          </div>
          {logs.length === 0 && <p className="text-gray-400 text-xs text-center py-4">No activity yet</p>}
          {logs.map(l => (
            <div key={l.id} className="text-sm text-gray-500 dark:text-gray-400 mb-3 pb-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <span className="font-medium text-gray-800 dark:text-gray-200">{l.user.name}</span> {l.action}
              <div className="text-xs text-gray-400 mt-0.5">{new Date(l.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {showMembers && (
        <div className="fixed right-4 top-24 bottom-4 w-80 bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl z-40 p-4 overflow-y-auto animate-slide-right">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-gray-400" />
              <h3 className="text-sm font-semibold">Board Members</h3>
            </div>
            <button onClick={() => setShowMembers(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition"><X size={14} /></button>
          </div>
          <div className="space-y-2 mb-4">
            {board.members?.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-[#6C4EF5] flex items-center justify-center text-white text-xs font-medium shrink-0">{m.user.name.charAt(0)}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{m.user.name}</p>
                    <p className="text-xs text-gray-400">{m.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <select value={m.role} onChange={e => handleUpdateMemberRole(m.userId, e.target.value)} className="text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5 outline-none text-gray-600 dark:text-gray-400">
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button onClick={() => handleRemoveMember(m.userId, m.user.name)} className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-red-500 transition"><X size={12} /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email..." className="input flex-1 text-sm" onKeyDown={e => e.key === 'Enter' && handleInvite()} />
            <button onClick={handleInvite} className="btn-primary text-xs">Invite</button>
          </div>
        </div>
      )}

      {showNewLabel && (
        <div className="fixed right-4 top-24 w-80 bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl z-40 p-4 animate-slide-right">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Tag size={14} className="text-gray-400" />
              <h3 className="text-sm font-semibold">Labels</h3>
            </div>
            <button onClick={() => setShowNewLabel(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition"><X size={14} /></button>
          </div>
          <div className="flex gap-2 mb-2">
            <input value={newLabelName} onChange={e => setNewLabelName(e.target.value)} placeholder="Label name" className="input flex-1 text-sm" onKeyDown={e => e.key === 'Enter' && handleAddLabel()} />
            <input type="color" value={newLabelColor} onChange={e => setNewLabelColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
          </div>
          <button onClick={handleAddLabel} className="btn-primary text-xs w-full mb-3">Create</button>
          {board.labels && board.labels.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {board.labels?.map(l => (
                <div key={l.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs" style={{ backgroundColor: l.colorHex + "12" }}>
                  <span style={{ color: l.colorHex }} className="font-medium">{l.name}</span>
                  <button onClick={() => handleDeleteLabel(l.id, l.name)} className="text-gray-400 hover:text-red-500 p-0.5 rounded"><X size={10} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedTask && (
        <TaskModal task={selectedTask} board={board} onClose={() => setSelectedTask(null)} onUpdate={task => { updateTaskInState(task); setSelectedTask(task); }} />
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ""}
        message={confirm?.message || ""}
        variant={confirm?.variant || "danger"}
        onConfirm={confirm?.onConfirm || (() => {})}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
