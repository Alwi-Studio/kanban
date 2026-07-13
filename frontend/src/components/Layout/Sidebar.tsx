import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Columns3, LayoutDashboard, Layers3, LogOut, Search, Settings, User, X } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { logout } from "../../services/auth";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Layers3, label: "Global board", path: "/global" },
  { icon: Columns3, label: "Boards", path: "/boards" },
  { icon: User, label: "Profile", path: "/profile" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useAuthStore();

  const go = (path: string) => {
    navigate(path);
    onClose?.();
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = search.trim();
    go(query ? `/global?q=${encodeURIComponent(query)}` : "/global");
  };

  const handleLogout = async () => {
    try { await logout(); } finally {
      setUser(null);
      navigate("/login");
    }
  };

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    if (path === "/boards") return location.pathname === "/boards" || location.pathname.startsWith("/board/");
    return location.pathname === path;
  };

  return (
    <>
      {mobileOpen && <button aria-label="Close navigation" onClick={onClose} className="fixed inset-0 z-40 bg-gray-950/40 md:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-surface-dark flex flex-col border-r border-gray-200 dark:border-gray-700 transition-transform md:static md:translate-x-0 md:flex ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-2 px-5 h-16 border-b border-gray-100 dark:border-gray-700">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-white text-sm font-bold shrink-0">A</div>
          <span className="font-bold text-base text-[#1A1A2E] dark:text-white flex-1">AlwiStudio</span>
          <button onClick={onClose} className="p-1 text-gray-400 md:hidden" aria-label="Close navigation"><X size={19} /></button>
        </div>

        <form onSubmit={submitSearch} className="px-4 pt-4 pb-3">
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search all tasks" aria-label="Search all tasks" className="w-full pl-9 pr-3 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 placeholder-gray-400 outline-none focus:ring-2 focus:ring-brand/20" />
          </div>
        </form>

        <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto">
          {menuItems.map(item => {
            const active = isActive(item.path);
            return (
              <button key={item.path} onClick={() => go(item.path)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium transition ${active ? "bg-gray-100 dark:bg-gray-800 text-[#1A1A2E] dark:text-white" : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}>
                <item.icon size={18} className={active ? "text-brand" : "text-gray-400"} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-medium shrink-0">{user?.name?.charAt(0).toUpperCase() || "U"}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1A1A2E] dark:text-white truncate">{user?.name || "User"}</p>
              <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
            </div>
            <button onClick={handleLogout} aria-label="Sign out" title="Sign out" className="p-1.5 text-gray-400 hover:text-red-500"><LogOut size={15} /></button>
          </div>
        </div>
      </aside>
    </>
  );
}
