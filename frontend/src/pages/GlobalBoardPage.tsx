import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowUpRight, CalendarDays, Layers3, Plus, Search, ShieldCheck, Users, X } from "lucide-react";
import Layout from "../components/Layout/Layout";
import TaskModal from "../components/TaskModal/TaskModal";
import { createTask, getGlobalBoard, updateTask } from "../services/board";
import type { GlobalBoard, Task } from "../types";
import { useAuthStore } from "../store/authStore";
import { useToast } from "../components/ui/Toast";

interface GlobalTask extends Task {
  boardId: string;
  boardName: string;
  workspaceId: string;
  workspaceName: string;
  columnName: string;
  columnPosition: number;
}

export default function GlobalBoardPage() {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [boards, setBoards] = useState<GlobalBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [boardId, setBoardId] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [selectedTask, setSelectedTask] = useState<GlobalTask | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskBoardId, setNewTaskBoardId] = useState("");
  const [newTaskColumnId, setNewTaskColumnId] = useState("");

  const load = () => {
    setLoading(true);
    setError(false);
    getGlobalBoard()
      .then(data => {
        setBoards(data.boards);
        setNewTaskBoardId(current => current || data.boards[0]?.id || "");
        setNewTaskColumnId(current => current || data.boards[0]?.columns[0]?.id || "");
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => setQuery(searchParams.get("q") || ""), [searchParams]);

  const tasks = useMemo<GlobalTask[]>(() => boards.flatMap(board =>
    board.columns.flatMap(column => column.tasks.map(task => ({
      ...task,
      boardId: board.id,
      boardName: board.name,
      workspaceId: board.workspaceId,
      workspaceName: board.workspaceName,
      columnName: column.name,
      columnPosition: column.position,
    }))),
  ), [boards]);

  const workspaces = useMemo(() => Array.from(new Map(boards.map(board => [board.workspaceId, board.workspaceName])).entries()), [boards]);
  const assignees = useMemo(() => Array.from(new Map(tasks.flatMap(task => task.assignees.map(a => [a.userId, a.user.name] as const))).entries()), [tasks]);

  const filteredTasks = useMemo(() => tasks.filter(task => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery && !`${task.title} ${task.description || ""} ${task.boardName} ${task.workspaceName}`.toLowerCase().includes(normalizedQuery)) return false;
    if (boardId && task.boardId !== boardId) return false;
    if (workspaceId && task.workspaceId !== workspaceId) return false;
    if (assigneeId && !task.assignees.some(a => a.userId === assigneeId)) return false;
    return true;
  }), [tasks, query, boardId, workspaceId, assigneeId]);

  const lanes = useMemo(() => {
    const map = new Map<string, { name: string; position: number; tasks: GlobalTask[] }>();
    for (const task of filteredTasks) {
      const key = task.columnName.trim().toLowerCase();
      const lane = map.get(key);
      if (lane) {
        lane.tasks.push(task);
        lane.position = Math.min(lane.position, task.columnPosition);
      } else {
        map.set(key, { name: task.columnName, position: task.columnPosition, tasks: [task] });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  }, [filteredTasks]);

  const updateQuery = (value: string) => {
    setQuery(value);
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set("q", value);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  };

  const moveGlobalTask = async (task: GlobalTask, targetColumnId: string) => {
    const board = boards.find(item => item.id === task.boardId);
    const target = board?.columns.find(column => column.id === targetColumnId);
    if (!target || target.id === task.columnId) return;
    try {
      await updateTask(task.id, { column_id: target.id, position: target.tasks.length, version: task.version });
      toast(`Moved to ${target.name}`, "success");
      load();
    } catch (error: any) { toast(error.response?.data?.error || "Failed to move task", "error"); }
  };

  const createGlobalTask = async () => {
    if (!newTaskTitle.trim() || !newTaskColumnId) return;
    try {
      await createTask(newTaskColumnId, newTaskTitle.trim());
      setNewTaskTitle("");
      setShowNewTask(false);
      toast("Task created", "success");
      load();
    } catch (error: any) { toast(error.response?.data?.error || "Failed to create task", "error"); }
  };

  return (
    <Layout>
      <div className="h-full flex flex-col min-w-0">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <Layers3 size={22} className="text-brand" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Global board</h1>
              {user?.isGlobalAdmin && <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-1 text-[10px] font-semibold text-brand"><ShieldCheck size={11} /> Admin editing</span>}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{loading ? "Loading tasks…" : `${filteredTasks.length} task${filteredTasks.length === 1 ? "" : "s"} across ${boards.length} board${boards.length === 1 ? "" : "s"}`}.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:flex gap-2">
            <label className="relative sm:col-span-2 xl:w-64">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={e => updateQuery(e.target.value)} placeholder="Search tasks" className="input pl-9" />
            </label>
            <select value={workspaceId} onChange={e => { setWorkspaceId(e.target.value); setBoardId(""); }} className="input xl:w-44" aria-label="Filter by workspace">
              <option value="">All workspaces</option>
              {workspaces.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <select value={boardId} onChange={e => setBoardId(e.target.value)} className="input xl:w-44" aria-label="Filter by board">
              <option value="">All boards</option>
              {boards.filter(board => !workspaceId || board.workspaceId === workspaceId).map(board => <option key={board.id} value={board.id}>{board.name}</option>)}
            </select>
            <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className="input xl:w-44" aria-label="Filter by assignee">
              <option value="">All assignees</option>
              {assignees.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            {user?.isGlobalAdmin && <button onClick={() => setShowNewTask(true)} className="btn-primary whitespace-nowrap"><Plus size={15} /> New task</button>}
          </div>
        </div>

        {showNewTask && user?.isGlobalAdmin && <div className="card mb-5 p-4 flex flex-col lg:flex-row gap-2 items-stretch lg:items-center">
          <input value={newTaskTitle} onChange={event => setNewTaskTitle(event.target.value)} onKeyDown={event => event.key === "Enter" && createGlobalTask()} placeholder="What needs to be done?" className="input flex-1" autoFocus />
          <select value={newTaskBoardId} onChange={event => { const nextBoard = boards.find(board => board.id === event.target.value); setNewTaskBoardId(event.target.value); setNewTaskColumnId(nextBoard?.columns[0]?.id || ""); }} className="input lg:w-48" aria-label="Board">
            {boards.map(board => <option key={board.id} value={board.id}>{board.name}</option>)}
          </select>
          <select value={newTaskColumnId} onChange={event => setNewTaskColumnId(event.target.value)} className="input lg:w-44" aria-label="Column">
            {boards.find(board => board.id === newTaskBoardId)?.columns.map(column => <option key={column.id} value={column.id}>{column.name}</option>)}
          </select>
          <button onClick={createGlobalTask} disabled={!newTaskTitle.trim() || !newTaskColumnId} className="btn-primary">Create</button>
          <button onClick={() => setShowNewTask(false)} className="btn-secondary" aria-label="Cancel"><X size={15} /></button>
        </div>}

        {loading && <div className="flex gap-4 overflow-hidden">{[1, 2, 3].map(i => <div key={i} className="w-72 shrink-0 h-80 rounded-2xl bg-gray-200/70 dark:bg-gray-800 animate-pulse" />)}</div>}

        {!loading && error && (
          <div className="card p-10 text-center max-w-lg mx-auto mt-12">
            <AlertCircle size={36} className="text-red-500 mx-auto mb-3" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Could not load the global board</h2>
            <button onClick={load} className="btn-primary mt-4">Try again</button>
          </div>
        )}

        {!loading && !error && lanes.length === 0 && (
          <div className="card p-10 text-center max-w-lg mx-auto mt-12">
            <Layers3 size={36} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <h2 className="font-semibold text-gray-900 dark:text-white">No matching tasks</h2>
            <p className="text-sm text-gray-500 mt-1">Try clearing the filters or create a task on one of your boards.</p>
          </div>
        )}

        {!loading && !error && lanes.length > 0 && (
          <div className="flex-1 flex gap-4 overflow-x-auto pb-4 scrollbar-thin items-start">
            {lanes.map((lane, index) => (
              <section key={lane.name.toLowerCase()} className="w-[18rem] shrink-0 rounded-2xl bg-gray-100/80 dark:bg-gray-900/40 p-3">
                <header className="flex items-center justify-between px-1 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full ${["bg-orange-400", "bg-brand", "bg-emerald-500", "bg-sky-500"][index % 4]}`} />
                    <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{lane.name}</h2>
                  </div>
                  <span className="text-xs text-gray-500 bg-white dark:bg-gray-800 rounded-full px-2 py-0.5">{lane.tasks.length}</span>
                </header>
                <div className="space-y-3">
                  {lane.tasks.map(task => (
                    <article key={task.id} onClick={() => user?.isGlobalAdmin ? setSelectedTask(task) : navigate(`/board/${task.boardId}`)} onKeyDown={event => { if (event.key === "Enter") user?.isGlobalAdmin ? setSelectedTask(task) : navigate(`/board/${task.boardId}`); }} role="button" tabIndex={0} className="card w-full p-4 text-left cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition group">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-medium text-brand bg-brand/10 rounded-full px-2 py-1 truncate">{task.boardName}</span>
                        <ArrowUpRight size={14} className="text-gray-300 group-hover:text-brand shrink-0" />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mt-2 leading-snug">{task.title}</h3>
                      {task.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>}
                      {task.taskLabels.length > 0 && <div className="flex flex-wrap gap-1 mt-3">{task.taskLabels.slice(0, 3).map(tl => <span key={tl.labelId} style={{ backgroundColor: `${tl.label.colorHex}20`, color: tl.label.colorHex }} className="text-[10px] rounded-full px-2 py-0.5">{tl.label.name}</span>)}</div>}
                      <div className="flex items-center justify-between gap-2 mt-3 text-[10px] text-gray-400">
                        <span className="truncate">{task.workspaceName}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          {task.dueDate && <span className="flex items-center gap-1"><CalendarDays size={11} />{new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
                          {task.assignees.length > 0 && <span className="flex items-center gap-1"><Users size={11} />{task.assignees.length}</span>}
                        </div>
                      </div>
                      {user?.isGlobalAdmin && <select value={task.columnId} onClick={event => event.stopPropagation()} onChange={event => { event.stopPropagation(); moveGlobalTask(task, event.target.value); }} className="input mt-3 py-1.5 text-[11px]" aria-label={`Move ${task.title}`}>
                        {boards.find(board => board.id === task.boardId)?.columns.map(column => <option key={column.id} value={column.id}>Move to: {column.name}</option>)}
                      </select>}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {selectedTask && user?.isGlobalAdmin && (() => {
          const sourceBoard = boards.find(board => board.id === selectedTask.boardId);
          if (!sourceBoard) return null;
          return <TaskModal task={selectedTask} board={sourceBoard} canEdit onClose={() => { setSelectedTask(null); load(); }} onUpdate={task => { setSelectedTask(current => current ? { ...current, ...task } : null); load(); }} />;
        })()}
      </div>
    </Layout>
  );
}
