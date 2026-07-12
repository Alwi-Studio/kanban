import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, CheckSquare, Users2, Settings, Search, LogOut } from "lucide-react";

const menuItems = [
  { icon: Home, label: "Home", path: "/", badge: 10 },
  { icon: CheckSquare, label: "Tasks", path: "/boards", badge: null },
  { icon: Users2, label: "Users", path: "/profile", badge: 2 },
  { icon: Settings, label: "Settings", path: "/settings", badge: null },
];

export default function Sidebar() {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    if (path === "/boards") return location.pathname.startsWith("/board");
    return location.pathname === path;
  };

  return (
    <aside className="w-64 bg-white dark:bg-surface-dark flex flex-col shrink-0 border-r border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-gray-100 dark:border-gray-700">
        <div className="w-8 h-8 rounded-lg bg-[#6C4EF5] flex items-center justify-center text-white text-sm font-bold shrink-0">A</div>
        <span className="font-bold text-base text-[#1A1A2E] dark:text-white">AlwiStudio</span>
      </div>

      <div className="px-4 pt-4 pb-3">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search"
            className="w-full pl-9 pr-3 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#6C4EF5]/20"
          />
        </div>
      </div>

      <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto">
        {menuItems.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.label}
              onClick={() => item.path !== "#" && navigate(item.path)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-full text-sm font-medium transition ${
                active
                  ? "bg-gray-100 dark:bg-gray-800 text-[#1A1A2E] dark:text-white"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon size={18} className={active ? "text-[#1A1A2E] dark:text-white" : "text-gray-400"} />
                <span>{item.label}</span>
              </div>
              {item.badge !== null && (
                <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full font-medium">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3 px-1">
          <div className="w-8 h-8 rounded-full bg-[#6C4EF5] flex items-center justify-center text-white text-xs font-medium shrink-0">U</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#1A1A2E] dark:text-white truncate">User</p>
            <p className="text-[10px] text-gray-400">Basic Member</p>
          </div>
          <button className="text-gray-300 dark:text-gray-600 hover:text-gray-500">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
