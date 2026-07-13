import { useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function Layout({ children, flush = false }: { children: React.ReactNode; flush?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex min-h-screen h-[100dvh] bg-bg-page dark:bg-bg-dark">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between md:justify-end px-4 sm:px-6 py-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-surface-dark">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 text-gray-500 md:hidden" aria-label="Open navigation"><Menu size={20} /></button>
          <Topbar />
        </div>
        <main className={`flex-1 overflow-auto ${flush ? "p-0" : "p-4 sm:p-6"}`}>{children}</main>
      </div>
    </div>
  );
}
