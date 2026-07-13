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
        <div className="sticky top-0 z-30 flex h-16 items-center justify-between md:justify-end px-4 sm:px-6 border-b border-gray-200/80 dark:border-gray-700 bg-white/90 dark:bg-surface-dark/90 backdrop-blur-xl">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded-lg text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden" aria-label="Open navigation"><Menu size={20} /></button>
          <Topbar />
        </div>
        <main className={`flex-1 overflow-auto ${flush ? "p-0" : "p-4 sm:p-6"}`}>{children}</main>
      </div>
    </div>
  );
}
