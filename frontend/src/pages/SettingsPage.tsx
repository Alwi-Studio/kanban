import { Moon, Sun } from "lucide-react";
import Layout from "../components/Layout/Layout";

export default function SettingsPage() {
  const isDark = document.documentElement.classList.contains("dark");

  const toggleDark = () => {
    document.documentElement.classList.toggle("dark");
    localStorage.setItem("darkMode", String(!isDark));
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your preferences</p>
        </div>

        <div className="card p-6">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Appearance</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">Dark Mode</p>
              <p className="text-xs text-gray-400">Toggle dark mode for the entire app</p>
            </div>
            <button
              onClick={toggleDark}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
