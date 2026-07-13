import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowUpRight, CheckCircle2, Columns3, Layers3, ListTodo, Search, ShieldCheck } from "lucide-react";
import Layout from "../components/Layout/Layout";
import AvatarStack from "../components/ui/AvatarStack";
import { getGlobalBoard } from "../services/board";
import type { GlobalBoard } from "../types";
import { useAuthStore } from "../store/authStore";

interface BoardSummary {
  id: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
  columnCount: number;
  taskCount: number;
  doneCount: number;
  members: { id: string; name: string }[];
}

export default function GlobalBoardPage() {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [boards, setBoards] = useState<GlobalBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [workspaceId, setWorkspaceId] = useState("");

  const load = () => {
    setLoading(true);
    setError(false);
    getGlobalBoard()
      .then(data => setBoards(data.boards))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => setQuery(searchParams.get("q") || ""), [searchParams]);

  const summaries = useMemo<BoardSummary[]>(() => boards.map(board => {
    const tasks = board.columns.flatMap(column => column.tasks);
    return {
      id: board.id,
      name: board.name,
      workspaceId: board.workspaceId,
      workspaceName: board.workspaceName,
      columnCount: board.columns.length,
      taskCount: tasks.length,
      doneCount: tasks.filter(task => task.completedAt).length,
      members: (board.members || []).map(member => member.user),
    };
  }), [boards]);

  const workspaces = useMemo(() => Array.from(new Map(boards.map(board => [board.workspaceId, board.workspaceName])).entries()), [boards]);

  // Match board name, workspace, or any task title/description so the sidebar's
  // "search all tasks" still points you to the board that holds a match.
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return summaries.filter(summary => {
      if (workspaceId && summary.workspaceId !== workspaceId) return false;
      if (!normalizedQuery) return true;
      if (`${summary.name} ${summary.workspaceName}`.toLowerCase().includes(normalizedQuery)) return true;
      const board = boards.find(item => item.id === summary.id);
      return Boolean(board?.columns.some(column => column.tasks.some(task =>
        `${task.title} ${task.description || ""}`.toLowerCase().includes(normalizedQuery),
      )));
    });
  }, [summaries, boards, query, workspaceId]);

  const updateQuery = (value: string) => {
    setQuery(value);
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set("q", value);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  };

  const openBoard = (id: string) => navigate(`/board/${id}`);

  return (
    <Layout>
      <div className="h-full flex flex-col min-w-0">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <Layers3 size={22} className="text-brand" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Global board</h1>
              {user?.isGlobalAdmin && <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-1 text-[10px] font-semibold text-brand"><ShieldCheck size={11} /> All boards</span>}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{loading ? "Loading boards…" : `${filtered.length} board${filtered.length === 1 ? "" : "s"}. Open one to jump straight in.`}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:flex gap-2">
            <label className="relative sm:col-span-2 xl:w-64">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={e => updateQuery(e.target.value)} placeholder="Search boards or tasks" className="input pl-9" aria-label="Search boards or tasks" />
            </label>
            <select value={workspaceId} onChange={e => setWorkspaceId(e.target.value)} className="input xl:w-48" aria-label="Filter by workspace">
              <option value="">All workspaces</option>
              {workspaces.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
        </div>

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-40 rounded-2xl bg-gray-200/70 dark:bg-gray-800 animate-pulse" />)}
          </div>
        )}

        {!loading && error && (
          <div className="card p-10 text-center max-w-lg mx-auto mt-12">
            <AlertCircle size={36} className="text-red-500 mx-auto mb-3" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Could not load the global board</h2>
            <button onClick={load} className="btn-primary mt-4">Try again</button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="card p-10 text-center max-w-lg mx-auto mt-12">
            <Layers3 size={36} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <h2 className="font-semibold text-gray-900 dark:text-white">No matching boards</h2>
            <p className="text-sm text-gray-500 mt-1">Try clearing the search or workspace filter.</p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(board => (
              <article
                key={board.id}
                onClick={() => openBoard(board.id)}
                onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openBoard(board.id); } }}
                role="button"
                tabIndex={0}
                aria-label={`Open board ${board.name}`}
                className="card p-5 text-left cursor-pointer border-l-4 border-l-brand hover:-translate-y-0.5 hover:shadow-md transition group flex flex-col"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate group-hover:text-brand transition">{board.name}</h2>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{board.workspaceName}</p>
                  </div>
                  <ArrowUpRight size={16} className="text-gray-300 group-hover:text-brand shrink-0 transition" />
                </div>

                <div className="flex items-center gap-3 mt-4 text-xs text-gray-500 dark:text-gray-400">
                  <span className="inline-flex items-center gap-1"><Columns3 size={13} className="text-gray-400" />{board.columnCount}</span>
                  <span className="inline-flex items-center gap-1"><ListTodo size={13} className="text-gray-400" />{board.taskCount} task{board.taskCount === 1 ? "" : "s"}</span>
                  {board.doneCount > 0 && <span className="inline-flex items-center gap-1 text-emerald-500"><CheckCircle2 size={13} />{board.doneCount} done</span>}
                </div>

                <div className="flex items-center justify-between gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  {board.members.length > 0
                    ? <AvatarStack users={board.members} max={4} />
                    : <span className="text-[11px] text-gray-400">No members</span>}
                  <span className="text-[11px] font-medium text-gray-400 group-hover:text-brand transition">Open →</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
