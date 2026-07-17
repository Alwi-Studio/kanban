import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Keyboard } from "lucide-react";

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["⌘", "K"], label: "Open command palette" },
  { keys: ["/"], label: "Search all tasks" },
  { keys: ["N"], label: "New task (on a board)" },
  { keys: ["B"], label: "New board" },
  { keys: ["?"], label: "Show this help" },
  { keys: ["Esc"], label: "Close dialogs" },
];

// Lightweight global keyboard shortcuts + the help overlay (press ?).
export default function GlobalShortcuts() {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setHelpOpen(false); return; }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.key === "?") { e.preventDefault(); setHelpOpen(o => !o); }
      else if (e.key === "b" || e.key === "B") { e.preventDefault(); navigate("/boards?new=1"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  if (!helpOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-gray-950/50 backdrop-blur-sm animate-fade-in" onClick={() => setHelpOpen(false)}>
      <div className="w-full max-w-sm bg-white dark:bg-[#141418] rounded-2xl border border-gray-200 dark:border-[#23232c] shadow-2xl overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()} role="dialog" aria-label="Keyboard shortcuts">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#23232c]">
          <div className="flex items-center gap-2">
            <Keyboard size={16} className="text-brand" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Keyboard shortcuts</h2>
          </div>
          <button onClick={() => setHelpOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400" aria-label="Close"><X size={15} /></button>
        </div>
        <div className="px-5 py-3 divide-y divide-gray-100 dark:divide-[#23232c]">
          {SHORTCUTS.map(s => (
            <div key={s.label} className="flex items-center justify-between py-2.5">
              <span className="text-sm text-gray-600 dark:text-gray-300">{s.label}</span>
              <span className="flex items-center gap-1">
                {s.keys.map(k => (
                  <kbd key={k} className="min-w-[22px] text-center text-[11px] font-semibold text-gray-500 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5">{k}</kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
