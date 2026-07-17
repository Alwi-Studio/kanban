import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Columns3, LayoutDashboard, Layers3, Radio, Shield, User, Settings, Plus, Moon, Sun, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getWorkspaces } from "../services/board";
import { useAuthStore } from "../store/authStore";
import type { Workspace } from "../types";

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: "Boards" | "Navigate" | "Actions";
  icon: LucideIcon;
  keywords?: string;
  run: () => void;
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("darkMode", String(isDark));
  window.dispatchEvent(new CustomEvent("dark-mode-change", { detail: isDark }));
}

// App-wide command palette. Open with ⌘K / Ctrl-K (or Ctrl-/); search boards,
// jump to any section, or run a quick action — all from the keyboard.
export default function CommandPalette() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [boards, setBoards] = useState<{ id: string; name: string; workspace: string }[]>([]);
  const [boardsLoaded, setBoardsLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Global open shortcut (⌘/Ctrl-K) plus a click-to-open custom event.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmdK = (e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K");
      if (cmdK) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  // Load the board list the first time the palette opens.
  useEffect(() => {
    if (!open || boardsLoaded) return;
    setBoardsLoaded(true);
    getWorkspaces()
      .then((data: Workspace[]) => {
        const flat = data.flatMap(ws => (ws.boards || []).map(b => ({ id: b.id, name: b.name, workspace: ws.name })));
        setBoards(flat);
      })
      .catch(() => { /* palette still works without boards */ });
  }, [open, boardsLoaded]);

  // Reset transient state each time it opens and focus the input.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const go = (path: string) => () => { setOpen(false); navigate(path); };
    const nav: Command[] = [
      { id: "nav-dashboard", label: "Dashboard", group: "Navigate", icon: LayoutDashboard, keywords: "home stats", run: go("/") },
      { id: "nav-boards", label: "Boards", group: "Navigate", icon: Columns3, keywords: "projects", run: go("/boards") },
      { id: "nav-global", label: "Global board", group: "Navigate", icon: Layers3, keywords: "org all tasks", run: go("/global") },
      { id: "nav-staff", label: "Staff Online", group: "Navigate", icon: Radio, keywords: "activity statistics", run: go("/staff") },
      ...(user?.isGlobalAdmin ? [{ id: "nav-admin", label: "Admin", group: "Navigate" as const, icon: Shield, keywords: "manage users", run: go("/admin") }] : []),
      { id: "nav-profile", label: "Profile", group: "Navigate", icon: User, run: go("/profile") },
      { id: "nav-settings", label: "Settings", group: "Navigate", icon: Settings, keywords: "preferences theme", run: go("/settings") },
    ];
    const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
    const actions: Command[] = [
      { id: "act-new-board", label: "Create new board", group: "Actions", icon: Plus, keywords: "add project", run: () => { setOpen(false); navigate("/boards?new=1"); } },
      { id: "act-search-tasks", label: query.trim() ? `Search all tasks for “${query.trim()}”` : "Search all tasks", group: "Actions", icon: Search, keywords: "find", run: () => { setOpen(false); navigate(query.trim() ? `/global?q=${encodeURIComponent(query.trim())}` : "/global"); } },
      { id: "act-theme", label: isDark ? "Switch to light theme" : "Switch to dark theme", group: "Actions", icon: isDark ? Sun : Moon, keywords: "dark mode appearance", run: () => { toggleTheme(); setOpen(false); } },
    ];
    const boardCmds: Command[] = boards.map(b => ({
      id: `board-${b.id}`,
      label: b.name,
      hint: b.workspace,
      group: "Boards",
      icon: Columns3,
      run: () => { setOpen(false); navigate(`/board/${b.id}`); },
    }));
    return [...boardCmds, ...nav, ...actions];
  }, [boards, user?.isGlobalAdmin, query, navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    // Keep the "search all tasks" action visible even while typing a free query.
    return commands.filter(c => c.id === "act-search-tasks" || `${c.label} ${c.hint || ""} ${c.keywords || ""}`.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => { setActive(0); }, [query]);

  // Keep the active row scrolled into view.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); filtered[active]?.run(); }
  };

  // Render with lightweight group headers while preserving a flat index for keys/nav.
  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[14vh] px-4 bg-gray-950/50 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-xl bg-white dark:bg-[#141418] rounded-2xl border border-gray-200 dark:border-[#23232c] shadow-2xl overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-3 px-4 border-b border-gray-100 dark:border-[#23232c]">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search boards, jump to a page, run an action…"
            aria-label="Command palette search"
            className="flex-1 bg-transparent py-4 text-sm outline-none text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
          />
          <kbd className="hidden sm:inline text-[10px] font-medium text-gray-400 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[min(60vh,22rem)] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No results for “{query}”</p>
          )}
          {filtered.map((cmd, idx) => {
            const header = cmd.group !== lastGroup ? cmd.group : null;
            lastGroup = cmd.group;
            const isActive = idx === active;
            const Icon = cmd.icon;
            return (
              <div key={cmd.id}>
                {header && <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{header}</div>}
                <button
                  data-idx={idx}
                  onClick={() => cmd.run()}
                  onMouseMove={() => setActive(idx)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition ${isActive ? "bg-brand/10 text-brand" : "text-gray-700 dark:text-gray-200"}`}
                >
                  <Icon size={16} className={isActive ? "text-brand" : "text-gray-400"} />
                  <span className="flex-1 truncate">{cmd.label}</span>
                  {cmd.hint && <span className="text-[11px] text-gray-400 truncate max-w-[40%]">{cmd.hint}</span>}
                  {isActive && <CornerDownLeft size={13} className="text-brand shrink-0" />}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 dark:border-[#23232c] text-[11px] text-gray-400">
          <span className="inline-flex items-center gap-1"><ArrowUp size={11} /><ArrowDown size={11} /> Navigate</span>
          <span className="inline-flex items-center gap-1"><CornerDownLeft size={11} /> Open</span>
          <span className="ml-auto inline-flex items-center gap-1"><kbd className="font-medium">⌘K</kbd> to toggle</span>
        </div>
      </div>
    </div>
  );
}
