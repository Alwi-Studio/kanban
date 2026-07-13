import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, Filter, List, ListTodo, X, Users, Tag, Share2, Search, Upload, ArrowUpDown, Eye, MessageSquare, Zap, Globe } from "lucide-react";
import { useBoardStore } from "../store/boardStore";
import { getBoard, createColumn, deleteColumn, updateColumn, updateTask, createTask, deleteTask, createLabel, deleteLabel, getActivityLogs, inviteMember, updateMemberRole, removeMember, updateBoard, deleteBoard, getAutomationRules, createAutomationRule, updateAutomationRule, deleteAutomationRule, getTransferTargets, transferBoard } from "../services/board";
import { connectSocket, joinBoard, leaveBoard } from "../services/socket";
import { useToast } from "../components/ui/Toast";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import ColumnView from "../components/Column/ColumnView";
import TaskCard from "../components/TaskCard/TaskCard";
import TaskModal from "../components/TaskModal/TaskModal";
import RoleBadge from "../components/ui/RoleBadge";
import Layout from "../components/Layout/Layout";
import type { Task, Column, Label, ActivityLog, BoardMember, AutomationRule } from "../types";
import { useAuthStore } from "../store/authStore";

const tabs = [
  { label: "All Tasks", key: "status" },
  { label: "Tasks Due", key: "due" },
  { label: "Tasks Completed", key: "completed" },
];

function apiError(error: any, fallback: string) {
  return error?.response?.data?.error || fallback;
}

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
  const user = useAuthStore(state => state.user);
  const currentRole = board?.members?.find(member => member.userId === user?.id)?.role;
  const canManageBoard = Boolean(user?.isGlobalAdmin) || currentRole === "admin" || currentRole === "owner";
  const canEditTasks = canManageBoard || currentRole === "pm" || currentRole === "member";
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskColId, setNewTaskColId] = useState("");
  const [newTaskTitleInput, setNewTaskTitleInput] = useState("");
  const [newColName, setNewColName] = useState("");
  const [showNewCol, setShowNewCol] = useState(false);
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [showAutomation, setShowAutomation] = useState(false);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [automationLabelId, setAutomationLabelId] = useState("");
  const [automationColumnId, setAutomationColumnId] = useState("");
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#6C4EF5");
  const [newTaskTitles, setNewTaskTitles] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [filterLabel, setFilterLabel] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [activeTab, setActiveTab] = useState("status");
  const [sortBy, setSortBy] = useState("manual");
  const [showFilters, setShowFilters] = useState(false);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [showSearchInput, setShowSearchInput] = useState(false);

  const [editingBoard, setEditingBoard] = useState(false);
  const [boardNameValue, setBoardNameValue] = useState("");
  const boardNameRef = useRef<HTMLInputElement>(null);
  const skipBoardNameBlurRef = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void; variant?: "danger" | "brand" } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const fetchBoard = useCallback(() => {
    if (!id) return;
    if (useBoardStore.getState().currentBoard?.id !== id) setLoading(true);
    setNotFound(false);
    setLoadError(false);
    getBoard(id)
      .then(data => setCurrentBoard(data))
      .catch(error => {
        if (error.response?.status === 403 || error.response?.status === 404) setNotFound(true);
        else setLoadError(true);
      })
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

    const hTaskUpdated = (task: Task) => {
      updateTaskInState(task);
      setSelectedTask(current => current?.id === task.id ? task : current);
    };
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
    socket.on("board:refresh", fetchBoard);

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
      socket.off("board:refresh", fetchBoard);
    };
  }, [id, fetchBoard, updateTaskInState, removeTaskFromState, addTaskToState, addColumnToState, updateColumnInState, removeColumnFromState, addLabelToBoard, removeLabelFromBoard, addMemberToBoard, updateMemberInBoard, removeMemberFromBoard]);

  const filteredTasks = useCallback((col: Column) => {
    let tasks = col.tasks;
    if (search) tasks = tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));
    if (filterLabel) tasks = tasks.filter(t => t.taskLabels.some(tl => tl.labelId === filterLabel));
    if (filterAssignee) tasks = tasks.filter(t => t.assignees.some(a => a.userId === filterAssignee));

    if (activeTab === "due") tasks = tasks.filter(t => t.dueDate);
    if (activeTab === "completed") tasks = tasks.filter(t => col.name.toLowerCase() === "done");

    if (sortBy === "oldest") tasks = [...tasks].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    else if (sortBy === "newest") tasks = [...tasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return tasks;
  }, [search, filterLabel, filterAssignee, activeTab, sortBy]);

  const hasActiveFilters = search || filterLabel || filterAssignee || activeTab !== "status";
  const canReorderTasks = canEditTasks && sortBy === "manual" && !hasActiveFilters;

  const handleDragStart = (event: DragStartEvent) => {
    if (!canEditTasks) return;
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
    if (!over || !board || !canEditTasks) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId.startsWith("column-")) {
      if (!canManageBoard) return;
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
      newPosition = targetTasks.length;
    } else {
      if (sourceCol.id === targetCol.id) {
        const originalIndex = targetCol.tasks.findIndex(t => t.id === overId);
        newPosition = originalIndex === -1 ? targetTasks.length : originalIndex;
      } else {
        const targetIndex = targetTasks.findIndex(t => t.id === overId);
        newPosition = targetIndex === -1 ? targetTasks.length : targetIndex;
      }
    }
    moveTask(activeId, sourceCol.id, targetCol.id, newPosition, task.version + 1);
    updateTask(activeId, { column_id: targetCol.id, position: newPosition, version: task.version })
      .then(() => { fetchBoard(); toast("Task moved", "success"); })
      .catch((err) => { fetchBoard(); toast(err.response?.data?.error || "Failed to move task", "error"); });
  };

  const loadLogs = useCallback(async () => {
    if (!id) return;
    try { setLogs(await getActivityLogs(id)); } catch (error: any) { toast(apiError(error, "Could not load activity"), "error"); }
  }, [id, toast]);

  useEffect(() => { if (showLog) loadLogs(); }, [showLog, loadLogs]);

  const confirmThen = (title: string, message: string, action: () => Promise<void>, successMsg: string) => {
    setConfirm({
      title, message, variant: "danger",
      onConfirm: async () => {
        setConfirm(null);
        try { await action(); toast(successMsg, "success"); } catch (error: any) { toast(apiError(error, "Action failed"), "error"); }
      },
    });
  };

  const handleAddColumn = async () => {
    if (!newColName.trim() || !id) return;
    try {
      await createColumn(id, newColName.trim());
      setNewColName(""); setShowNewCol(false);
      toast(`Column created`, "success");
    } catch (error: any) { toast(apiError(error, "Failed to create column"), "error"); }
  };

  const handleDeleteColumn = (colId: string, colName: string) => {
    confirmThen("Delete column", `Delete "${colName}" and all its tasks?`, () => deleteColumn(colId), `Column "${colName}" deleted`);
  };

  const handleRenameColumn = async (colId: string, name: string) => {
    try {
      const updated = await updateColumn(colId, { name });
      updateColumnInState(updated);
      toast(`Column renamed`, "success");
    } catch (error: any) { toast(apiError(error, "Failed to rename column"), "error"); }
  };

  const handleAddTask = async (colId: string, customTitle?: string) => {
    const title = customTitle || newTaskTitles[colId]?.trim();
    if (!title) return;
    try {
      const task = await createTask(colId, title);
      addTaskToState(task);
      setNewTaskTitles(p => ({ ...p, [colId]: "" }));
      toast(`Task created`, "success");
    } catch (error: any) { toast(apiError(error, "Failed to create task"), "error"); }
  };

  const handleDeleteTask = (taskId: string, title: string) => {
    confirmThen("Delete task", `Delete "${title}"?`, () => deleteTask(taskId), `Task deleted`);
  };

  const handleAddLabel = async () => {
    if (!newLabelName.trim() || !id) return;
    try {
      const label = await createLabel(id, newLabelName.trim(), newLabelColor);
      addLabelToBoard(label);
      setNewLabelName(""); setShowNewLabel(false);
      toast(`Label created`, "success");
    } catch (error: any) { toast(apiError(error, "Failed to create label"), "error"); }
  };

  const handleDeleteLabel = (labelId: string, labelName: string) => {
    confirmThen("Delete label", `Delete "${labelName}"?`, () => deleteLabel(id!, labelId), `Label deleted`);
  };

  const openAutomation = async () => {
    if (!id || !board) return;
    setShowAutomation(true);
    setShowNewLabel(false);
    setAutomationColumnId(board.columns[0]?.id || "");
    try {
      const rules = await getAutomationRules(id);
      setAutomationRules(rules);
      setAutomationLabelId(board.labels?.find(label => !rules.some(rule => rule.labelId === label.id))?.id || "");
    }
    catch (error: any) { toast(apiError(error, "Failed to load automations"), "error"); }
  };

  const handleCreateAutomation = async () => {
    if (!id || !automationLabelId || !automationColumnId) return;
    try {
      const rule = await createAutomationRule(id, automationLabelId, automationColumnId);
      setAutomationRules(current => [...current, rule]);
      setAutomationLabelId(board?.labels?.find(label => label.id !== automationLabelId && !automationRules.some(existing => existing.labelId === label.id))?.id || "");
      toast("Automation enabled", "success");
    } catch (error: any) { toast(apiError(error, "Failed to create automation"), "error"); }
  };

  const handleToggleAutomation = async (rule: AutomationRule) => {
    try {
      const updated = await updateAutomationRule(id!, rule.id, { enabled: !rule.enabled });
      setAutomationRules(current => current.map(item => item.id === rule.id ? updated : item));
    } catch (error: any) { toast(apiError(error, "Failed to update automation"), "error"); }
  };

  const handleDeleteAutomation = async (ruleId: string) => {
    try {
      await deleteAutomationRule(id!, ruleId);
      setAutomationRules(current => current.filter(rule => rule.id !== ruleId));
      toast("Automation removed", "success");
    } catch (error: any) { toast(apiError(error, "Failed to remove automation"), "error"); }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !id) return;
    try {
      await inviteMember(id, inviteEmail);
      setInviteEmail("");
      toast("Member invited", "success");
    } catch (error: any) { toast(apiError(error, "Failed to invite member"), "error"); }
  };

  const handleUpdateMemberRole = async (userId: string, role: string) => {
    try {
      const updated = await updateMemberRole(id!, userId, role);
      updateMemberInBoard(updated);
      toast("Member role updated", "success");
    } catch (error: any) { toast(apiError(error, "Failed to update role"), "error"); }
  };

  const handleRemoveMember = (userId: string, userName: string) => {
    confirmThen("Remove member", `Remove "${userName}"?`, () => removeMember(id!, userId), `Member removed`);
  };

  const handleSaveBoardName = async () => {
    if (!boardNameValue.trim() || !id) {
      setBoardNameValue(board?.name || "");
      setEditingBoard(false);
      return;
    }
    try {
      const updated = await updateBoard(id, { name: boardNameValue.trim() });
      setCurrentBoard({ ...board!, name: updated.name });
      setEditingBoard(false);
      toast("Board renamed", "success");
    } catch {
      setBoardNameValue(board?.name || "");
      setEditingBoard(false);
      toast("Failed to rename board", "error");
    }
  };

  const handleToggleGlobal = async () => {
    if (!id || !board) return;
    const next = !board.isGlobal;
    try {
      const updated = await updateBoard(id, { isGlobal: next });
      setCurrentBoard({ ...board, isGlobal: updated.isGlobal });
      toast(next ? "Board added to the Global board" : "Board removed from the Global board", "success");
    } catch (error: any) {
      toast(apiError(error, "Failed to update the board"), "error");
    }
  };

  const handleDeleteBoardAction = () => {
    confirmThen("Delete board", `Delete "${board?.name}"? This cannot be undone.`, async () => {
      await deleteBoard(id!);
      navigate("/");
    }, `Board deleted`);
  };

  const handleShareBoard = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("Board link copied", "success");
    } catch {
      toast("Could not copy the board link", "error");
    }
  };

  const handleExportBoard = () => {
    if (!board) return;
    const blob = new Blob([JSON.stringify(board, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${board.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "board"}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast("Board exported", "success");
  };

  if (loading) return (
    <Layout flush><div className="flex h-full bg-bg-page dark:bg-bg-dark">
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
    </div></Layout>
  );

  if (notFound) return (
    <Layout flush><div className="flex h-full bg-bg-page dark:bg-bg-dark items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <ListTodo size={28} className="text-gray-400" />
        </div>
        <p className="text-gray-500">Board not found</p>
        <button onClick={() => navigate("/")} className="btn-primary text-xs">Back to Dashboard</button>
      </div>
    </div></Layout>
  );

  if (loadError) return (
    <Layout flush><div className="flex h-full bg-bg-page dark:bg-bg-dark items-center justify-center">
      <div className="card p-8 text-center">
        <p className="text-gray-600 dark:text-gray-300">Could not load this board.</p>
        <button onClick={fetchBoard} className="btn-primary text-xs mt-4">Try again</button>
      </div>
    </div></Layout>
  );

  if (!board) return null;

  const totalTasks = board.columns.reduce((s, c) => s + c.tasks.length, 0);

  return (
    <Layout flush><div className="flex h-full bg-bg-page dark:bg-bg-dark">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-surface-dark">
          <div className="flex items-center gap-4">
            <div>
              <div className="group flex items-center gap-2">
                {editingBoard ? (
                  <div className="flex items-center gap-1">
                    <input
                      ref={boardNameRef}
                      value={boardNameValue}
                      onChange={e => setBoardNameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") {
                          skipBoardNameBlurRef.current = true;
                          setEditingBoard(false);
                          setBoardNameValue(board.name);
                        }
                      }}
                      onBlur={() => {
                        if (skipBoardNameBlurRef.current) {
                          skipBoardNameBlurRef.current = false;
                          return;
                        }
                        handleSaveBoardName();
                      }}
                      className="text-lg font-bold bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full px-3 py-1 outline-none text-[#1A1A2E] dark:text-white"
                    />
                  </div>
                ) : (
                  <h1 className="text-lg font-bold text-[#1A1A2E] dark:text-white" onDoubleClick={() => { skipBoardNameBlurRef.current = false; setEditingBoard(true); setBoardNameValue(board.name); }}>
                    {board.name}
                  </h1>
                )}
                {canManageBoard && <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                  <button onClick={() => { skipBoardNameBlurRef.current = false; setEditingBoard(true); setBoardNameValue(board.name); }} className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-[#6C4EF5] hover:bg-[#6C4EF5]/10 transition" title="Rename">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  </button>
                  <button onClick={handleDeleteBoardAction} className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition" title="Delete">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <button onClick={() => navigate("/")} className="text-[11px] text-gray-400 hover:text-[#6C4EF5] transition">Home</button>
                <span className="text-gray-300 dark:text-gray-600 text-[11px]">/</span>
                <span className="text-[11px] text-gray-600 dark:text-gray-300 font-medium">{board.name}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 pt-4 pb-3 bg-white dark:bg-surface-dark border-b border-gray-100 dark:border-gray-700 shadow-sm">
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
                    className="pl-8 pr-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-100 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-[#6C4EF5]/20 w-48"
                    onBlur={() => { if (!search) setShowSearchInput(false); }}
                    onKeyDown={e => e.key === "Escape" && setShowSearchInput(false)}
                  />
                </div>
              ) : (
                <button onClick={() => setShowSearchInput(true)} className="p-1.5 rounded-full text-gray-400 hover:text-[#6C4EF5] hover:bg-[#6C4EF5]/10 transition" title="Search">
                  <Search size={14} />
                </button>
              )}
              <button onClick={handleShareBoard} className="btn-secondary px-3 py-2 text-xs">
                <Share2 size={12} /> Share
              </button>
              <button onClick={handleExportBoard} className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition" title="Export">
                <Upload size={14} />
              </button>
              {canEditTasks && <div className="relative">
                <button onClick={() => { setShowNewTask(true); setNewTaskColId(board.columns[0]?.id || ""); setNewTaskTitleInput(""); }} className="btn-primary px-3 py-2 text-xs" title="New Task">
                  <Plus size={14} /> <span className="hidden sm:inline">New task</span>
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
              </div>}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 overflow-x-auto scrollbar-thin pb-1">
            <div className="flex items-center gap-1 shrink-0">
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
                  {tab.key === "status" && <span className="ml-1 text-[10px] opacity-60">({totalTasks})</span>}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${hasActiveFilters ? "text-[#6C4EF5] bg-[#6C4EF5]/10" : "text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"}`} title="Filters">
                <Filter size={14} /> Filters
              </button>
              <button onClick={() => setShowLog(!showLog)} className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition" title="Activity Log">
                <List size={14} />
              </button>
              <button onClick={() => setShowMembers(!showMembers)} className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition" title="Members">
                <Users size={14} />
              </button>
              {canManageBoard && <button onClick={() => setShowNewLabel(!showNewLabel)} className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition" title="Labels">
                <Tag size={14} />
              </button>}
              {canManageBoard && <button onClick={openAutomation} className={`p-1.5 rounded-full transition ${showAutomation ? "text-amber-500 bg-amber-500/10" : "text-gray-400 hover:text-amber-500 hover:bg-amber-500/10"}`} title="Automation rules">
                <Zap size={14} />
              </button>}
              {canManageBoard && <button onClick={handleToggleGlobal} aria-pressed={Boolean(board.isGlobal)} className={`p-1.5 rounded-full transition ${board.isGlobal ? "text-brand bg-brand/10" : "text-gray-400 hover:text-brand hover:bg-brand/10"}`} title={board.isGlobal ? "On the Global board — click to remove" : "Show on the Global board"}>
                <Globe size={14} />
              </button>}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="text-xs bg-gray-100 dark:bg-gray-800 rounded-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-600 outline-none text-gray-500 dark:text-gray-400"
              >
                <option value="manual">Sort By: Board order</option>
                <option value="newest">Sort By: Newest</option>
                <option value="oldest">Sort By: Oldest</option>
              </select>
            </div>
          </div>

          {showFilters && (
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <select value={filterLabel} onChange={e => setFilterLabel(e.target.value)} className="rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs outline-none text-gray-600 dark:text-gray-200">
                <option value="">All labels</option>
                {board.labels?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className="rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs outline-none text-gray-600 dark:text-gray-200">
                <option value="">All members</option>
                {board.members?.map(m => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}
              </select>
              {hasActiveFilters && <button onClick={() => { setSearch(""); setFilterLabel(""); setFilterAssignee(""); setActiveTab("status"); }} className="text-red-500 text-xs font-medium hover:underline">Clear</button>}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-x-auto scrollbar-thin p-4 sm:p-6 bg-[radial-gradient(circle_at_top_left,rgba(108,78,245,0.04),transparent_32%)]">
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <SortableContext items={board.columns.map(c => `column-${c.id}`)} strategy={horizontalListSortingStrategy}>
              <div className="flex gap-4 h-full items-start">
                {board.columns.length === 0 && !showNewCol && (
                  <div className="flex flex-col items-center justify-center w-full h-48 gap-2 text-gray-400">
                    <ListTodo size={28} className="text-gray-300 dark:text-gray-600" />
                    <p className="text-sm">No columns yet</p>
                    {canManageBoard && <button onClick={() => setShowNewCol(true)} className="btn-primary text-xs">Create your first column</button>}
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
                    canEditTasks={canEditTasks}
                    canReorderTasks={canReorderTasks}
                    canManageColumn={canManageBoard}
                  />
                ))}
                {canManageBoard && !showNewCol && (
                  <button onClick={() => setShowNewCol(true)} className="card p-3 w-72 shrink-0 self-start flex items-center justify-center gap-2 text-gray-400 hover:text-[#6C4EF5] hover:border-[#6C4EF5]/30 border-2 border-dashed border-gray-300 dark:border-gray-600 transition-all duration-200 min-h-[80px] rounded-2xl">
                    <Plus size={16} />
                    <span className="text-sm font-medium">Add Column</span>
                  </button>
                )}
                {canManageBoard && showNewCol && (
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
        <div className="fixed left-4 right-4 sm:left-auto sm:w-80 top-24 bottom-4 bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl z-40 p-4 overflow-y-auto animate-slide-right">
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
        <div className="fixed left-4 right-4 sm:left-auto sm:w-80 top-24 bottom-4 bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl z-40 p-4 overflow-y-auto animate-slide-right">
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
                {canManageBoard && <div className="flex items-center gap-1 shrink-0">
                  <select value={m.role} onChange={e => handleUpdateMemberRole(m.userId, e.target.value)} className="text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5 outline-none text-gray-600 dark:text-gray-400">
                    <option value="admin">Admin</option>
                    <option value="pm">Project Manager</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button onClick={() => handleRemoveMember(m.userId, m.user.name)} className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-red-500 transition"><X size={12} /></button>
                </div>}
                {!canManageBoard && <RoleBadge role={m.role} />}
              </div>
            ))}
          </div>
          {canManageBoard && <div className="flex gap-2">
            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email..." className="input flex-1 text-sm" onKeyDown={e => e.key === 'Enter' && handleInvite()} />
            <button onClick={handleInvite} className="btn-primary text-xs">Invite</button>
          </div>}
        </div>
      )}

      {canManageBoard && showNewLabel && (
        <div className="fixed left-4 right-4 sm:left-auto sm:w-80 top-24 bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl z-40 p-4 animate-slide-right">
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

      {canManageBoard && showAutomation && (
        <div className="fixed left-4 right-4 sm:left-auto sm:w-96 top-24 bottom-4 bg-white dark:bg-surface-dark rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl z-40 p-4 overflow-y-auto animate-slide-right">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2"><Zap size={15} className="text-amber-500" /><h3 className="text-sm font-semibold">Automation</h3></div>
            <button onClick={() => setShowAutomation(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"><X size={14} /></button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Move a task automatically when a label is added.</p>

          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-3 space-y-2">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400">When label is added</label>
            <select value={automationLabelId} onChange={event => setAutomationLabelId(event.target.value)} className="input text-xs">
              <option value="">Choose a label</option>
              {board.labels?.filter(label => !automationRules.some(rule => rule.labelId === label.id)).map(label => <option key={label.id} value={label.id}>{label.name}</option>)}
            </select>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400">Move task to</label>
            <select value={automationColumnId} onChange={event => setAutomationColumnId(event.target.value)} className="input text-xs">
              <option value="">Choose a column</option>
              {board.columns.map(column => <option key={column.id} value={column.id}>{column.name}</option>)}
            </select>
            <button onClick={handleCreateAutomation} disabled={!automationLabelId || !automationColumnId} className="btn-primary text-xs w-full"><Zap size={13} /> Add rule</button>
          </div>

          <div className="mt-4 space-y-2">
            {automationRules.map(rule => (
              <div key={rule.id} className={`rounded-xl border p-3 ${rule.enabled ? "border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5" : "border-gray-200 dark:border-gray-700 opacity-60"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs leading-5"><span className="font-semibold" style={{ color: rule.label.colorHex }}>{rule.label.name}</span><span className="text-gray-400"> → </span><span className="font-semibold text-gray-700 dark:text-gray-200">{rule.targetColumn.name}</span></div>
                  <button onClick={() => handleDeleteAutomation(rule.id)} className="text-gray-400 hover:text-red-500" aria-label="Delete automation"><X size={13} /></button>
                </div>
                <button onClick={() => handleToggleAutomation(rule)} className={`mt-2 text-[10px] font-semibold ${rule.enabled ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500"}`}>{rule.enabled ? "Enabled" : "Disabled"} · click to toggle</button>
              </div>
            ))}
            {automationRules.length === 0 && <p className="text-xs text-gray-400 text-center py-5">No automation rules yet.</p>}
          </div>
        </div>
      )}

      {selectedTask && (
        <TaskModal task={selectedTask} board={board} canEdit={canEditTasks} onClose={() => setSelectedTask(null)} onUpdate={task => { updateTaskInState(task); setSelectedTask(task); }} />
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ""}
        message={confirm?.message || ""}
        variant={confirm?.variant || "danger"}
        onConfirm={confirm?.onConfirm || (() => {})}
        onCancel={() => setConfirm(null)}
      />
    </div></Layout>
  );
}
