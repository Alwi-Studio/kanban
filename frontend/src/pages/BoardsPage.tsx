import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Columns3, Plus } from "lucide-react";
import { getWorkspaces, createBoard } from "../services/board";
import { useToast } from "../components/ui/Toast";
import Layout from "../components/Layout/Layout";
import type { Workspace } from "../types";
import { useAuthStore } from "../store/authStore";

export default function BoardsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = useAuthStore(s => s.user);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoadError(false);
    getWorkspaces()
      .then(data => {
        setWorkspaces(data);
        const firstOwned = data.find(ws => user?.isGlobalAdmin || ws.ownerId === user?.id);
        setSelectedWorkspaceId(firstOwned?.id || "");
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const handleCreateBoard = async () => {
    if (!newBoardName.trim() || !selectedWorkspaceId) return;
    try {
      const board = await createBoard(selectedWorkspaceId, newBoardName.trim());
      setShowNewBoard(false);
      setNewBoardName("");
      toast(`Board "${board.name}" created`, "success");
      navigate(`/board/${board.id}`);
    } catch {
      toast("Failed to create board", "error");
    }
  };

  const ownedWorkspaces = workspaces.filter(ws => user?.isGlobalAdmin || ws.ownerId === user?.id);

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2 animate-pulse" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
            </div>
            <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-28 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Boards</h1>
            <p className="text-sm text-gray-500 mt-1">All your project boards in one place</p>
          </div>
          <button disabled={ownedWorkspaces.length === 0} onClick={() => setShowNewBoard(true)} className="btn-primary flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
            <Plus size={16} /> New Board
          </button>
        </div>

        {showNewBoard && (
          <div className="card p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <select value={selectedWorkspaceId} onChange={e => setSelectedWorkspaceId(e.target.value)} className="input sm:max-w-56" aria-label="Workspace">
              {ownedWorkspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
            </select>
            <input
              value={newBoardName}
              onChange={e => setNewBoardName(e.target.value)}
              placeholder="Board name"
              className="input flex-1"
              autoFocus
              onKeyDown={e => e.key === "Enter" && handleCreateBoard()}
            />
            <button onClick={handleCreateBoard} className="btn-primary">Create</button>
            <button onClick={() => { setShowNewBoard(false); setNewBoardName(""); }} className="btn-secondary">Cancel</button>
          </div>
        )}

        {loadError && (
          <div className="card p-8 text-center border-red-200 dark:border-red-900">
            <p className="text-sm text-red-600 dark:text-red-400">Could not load your boards.</p>
            <button onClick={() => window.location.reload()} className="btn-secondary text-xs mt-3">Try again</button>
          </div>
        )}

        {!loadError && workspaces.length === 0 && (
          <div className="card p-12 text-center">
            <Columns3 size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No workspaces yet. Create your first board!</p>
          </div>
        )}

        {workspaces.map(ws => (
          <div key={ws.id}>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{ws.name}</h2>
              {ws.ownerId !== user?.id && <span className="text-[10px] font-medium text-brand bg-brand/10 px-2 py-0.5 rounded-full">Shared</span>}
              <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                {ws.boards?.length || 0} boards
              </span>
            </div>
            {ws.boards && ws.boards.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {ws.boards.map(board => (
                  <div
                    key={board.id}
                    onClick={() => navigate(`/board/${board.id}`)}
                    className="card p-5 cursor-pointer hover:shadow-md transition border-l-4 border-l-brand group"
                  >
                    <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-brand transition">
                      {board.name}
                    </h3>
                    <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                      <span>{board.columns?.length || 0} columns</span>
                      <span>•</span>
                      <span>{board.columns?.reduce((s, c) => s + (c.tasks?.length || 0), 0) || 0} tasks</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card p-8 text-center">
                <p className="text-gray-400 text-sm">No boards yet in this workspace.</p>
                {(user?.isGlobalAdmin || ws.ownerId === user?.id) && <button onClick={() => { setSelectedWorkspaceId(ws.id); setShowNewBoard(true); }} className="btn-primary text-xs mt-3">Create your first board</button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </Layout>
  );
}
