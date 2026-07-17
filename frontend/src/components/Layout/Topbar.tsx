import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, LogOut, Moon, Sun, Shield, User, Settings } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { logout } from "../../services/auth";
import RoleBadge from "../ui/RoleBadge";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../../services/board";
import type { Notification } from "../../types";
import { connectSocket } from "../../services/socket";
import { useToast } from "../ui/Toast";

export default function Topbar() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("darkMode");
    return stored === "true" || (stored === null && document.documentElement.classList.contains("dark"));
  });
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (dark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("darkMode", String(dark));
  }, [dark]);

  useEffect(() => {
    const syncDarkMode = (event: Event) => setDark((event as CustomEvent<boolean>).detail);
    window.addEventListener("dark-mode-change", syncDarkMode);
    return () => window.removeEventListener("dark-mode-change", syncDarkMode);
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".notif-panel") && !target.closest(".notif-btn")) setShowNotif(false);
      if (!target.closest(".user-panel") && !target.closest(".user-btn")) setShowUserMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const handleLogout = async () => {
    await logout();
    setUser(null);
    navigate("/login");
  };

  const loadNotifs = async () => {
    try {
      const r = await getNotifications();
      setNotifs(r.notifications);
      setUnread(r.unread);
    } catch {}
  };

  useEffect(() => {
    loadNotifs();
  }, []);

  useEffect(() => {
    const socket = connectSocket();
    const onNotification = (notification: Notification) => {
      setNotifs(current => [notification, ...current.filter(item => item.id !== notification.id)]);
      setUnread(current => current + 1);
    };
    socket.on("notification:new", onNotification);
    return () => { socket.off("notification:new", onNotification); };
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setUnread(0);
      setNotifs(current => current.map(item => ({ ...item, isRead: true })));
    } catch { toast("Failed to update notifications", "error"); }
  };

  const handleMarkRead = async (notificationId: string) => {
    try {
      await markNotificationRead(notificationId);
      setUnread(current => Math.max(0, current - 1));
      setNotifs(current => current.map(item => item.id === notificationId ? { ...item, isRead: true } : item));
    } catch { toast("Failed to update notification", "error"); }
  };

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => setDark(!dark)} aria-label={dark ? "Use light mode" : "Use dark mode"} title={dark ? "Use light mode" : "Use dark mode"} className="p-2.5 rounded-xl text-gray-500 dark:text-gray-300 hover:text-brand hover:bg-brand/10 transition">
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div className="relative notif-btn">
        <button onClick={() => { setShowNotif(!showNotif); if (!showNotif) loadNotifs(); }} aria-label="Notifications" className="p-2.5 rounded-xl text-gray-500 dark:text-gray-300 hover:text-brand hover:bg-brand/10 transition relative">
          <Bell size={16} />
          {unread > 0 && <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center font-medium">{unread}</span>}
        </button>
        {showNotif && (
          <div className="notif-panel absolute top-full right-0 mt-2 bg-white dark:bg-[#141418] rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg w-72 z-50 max-h-72 overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <span className="text-xs font-semibold text-[#1A1A2E] dark:text-white">Notifications</span>
              {unread > 0 && <button onClick={handleMarkAllRead} className="text-[#ff5a30] text-[10px] font-medium">Mark all read</button>}
            </div>
            {notifs.length === 0 && <p className="text-gray-400 text-xs text-center py-6">No notifications</p>}
            {notifs.map(n => (
              <div key={n.id} className={`px-4 py-3 text-xs border-b border-gray-100 dark:border-gray-700 last:border-0 ${n.isRead ? "" : "bg-[#ff5a30]/5"}`}>
                <p className={n.isRead ? "text-gray-500 dark:text-gray-400" : "text-gray-800 dark:text-gray-100"}>{n.message}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-gray-400 text-[10px]">{new Date(n.createdAt).toLocaleDateString()}</span>
                  {!n.isRead && <button onClick={() => handleMarkRead(n.id)} className="text-[#ff5a30] text-[10px]">Read</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative user-btn">
        <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition">
          <div className="w-7 h-7 rounded-full bg-[#ff5a30] flex items-center justify-center text-white text-[11px] font-medium">
            {user?.name?.charAt(0) || "U"}
          </div>
        </button>
        {showUserMenu && (
          <div className="user-panel absolute top-full right-0 mt-2 bg-white dark:bg-[#141418] rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg w-44 z-50 py-1 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
              <p className="text-xs font-medium text-[#1A1A2E] dark:text-white">{user?.name}</p>
              <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
              {user?.isGlobalAdmin && <div className="mt-1.5"><RoleBadge role="global" /></div>}
            </div>
            <button onClick={() => { setShowUserMenu(false); navigate("/profile"); }} className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
              <User size={12} /> Profile
            </button>
            {user?.isGlobalAdmin && (
              <button onClick={() => { setShowUserMenu(false); navigate("/admin"); }} className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
                <Shield size={12} /> Admin
              </button>
            )}
            <button onClick={() => { setShowUserMenu(false); navigate("/settings"); }} className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
              <Settings size={12} /> Settings
            </button>
            <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-500 hover:bg-gray-50 dark:hover:bg-gray-800">
              <LogOut size={12} /> Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
