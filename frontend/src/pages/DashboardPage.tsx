import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, ListTodo, CheckCircle2, AlertCircle, Trophy, Layers, Clock, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getDashboardStats } from "../services/board";
import StatCard from "../components/ui/StatCard";
import Layout from "../components/Layout/Layout";
import type { DashboardStats } from "../types";

function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`card p-5 animate-pulse ${className}`}>
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
      <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3" />
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="card p-6 animate-pulse">
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
        ))}
      </div>
    </div>
  );
}

function TrendBadge({ value, up }: { value: number; up: boolean }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-green-500" : "text-red-500"}`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {value}%
    </span>
  );
}

function ProgressBar({ value, max, color = "bg-brand" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

type Period = "30d" | "7d" | "24h";
type StatsView = "personal" | "global";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState<Period>("30d");
  const [statsView, setStatsView] = useState<StatsView>("personal");

  const loadStats = () => {
    setLoading(true);
    setError(false);
    getDashboardStats()
      .then(setStats)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(loadStats, []);

  const filteredTrends = (() => {
    if (!stats) return [];
    const days = period === "30d" ? 30 : period === "7d" ? 7 : 1;
    return stats.taskTrends.slice(-days);
  })();

  const periodLabels: Record<Period, string> = {
    "30d": "30 hari",
    "7d": "7 hari",
    "24h": "24 jam",
  };
  const summary = statsView === "personal" ? stats?.personal : stats;

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-2 animate-pulse" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-60 animate-pulse" />
            </div>
            <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-28 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2"><SkeletonRow /></div>
            <div><SkeletonRow /></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return <Layout><div className="card max-w-lg mx-auto p-10 text-center">
      <p className="text-gray-600 dark:text-gray-300">Could not load dashboard statistics.</p>
      <button onClick={loadStats} className="btn-primary mt-4">Try again</button>
    </div></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{statsView === "personal" ? "Tasks assigned to you" : `${stats?.boardCount || 0} boards in ${stats?.scope === "organization" ? "the organization" : "your accessible workspace"}`}</p>
          </div>
          <div className="inline-flex self-start sm:self-auto rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
            <button onClick={() => setStatsView("personal")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${statsView === "personal" ? "bg-white dark:bg-gray-700 text-brand shadow-sm" : "text-gray-500 dark:text-gray-400"}`}>My statistics</button>
            <button onClick={() => setStatsView("global")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${statsView === "global" ? "bg-white dark:bg-gray-700 text-brand shadow-sm" : "text-gray-500 dark:text-gray-400"}`}>{stats?.isGlobalAdmin ? "Organization" : "All my boards"}</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Tasks" value={summary?.totalTasks ?? 0} icon={<ListTodo size={20} />} />
          <StatCard label="Finished" value={summary?.completedTasks ?? 0} icon={<CheckCircle2 size={20} />} color="success" />
          <StatCard label="Overdue" value={summary?.overdueTasks ?? 0} icon={<AlertCircle size={20} />} color={summary?.overdueTasks ? "danger" : "brand"} />
          <StatCard label="Avg Completion" value={summary?.avgCompletionTime ? `${summary.avgCompletionTime}d` : "—"} icon={<LayoutDashboard size={20} />} color="brand" />
        </div>

        <div className="flex items-center gap-2 pt-1"><span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" /><span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Overall workflow</span><span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" /></div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Progress Task per Waktu</h2>
                <p className="text-xs text-gray-400 mt-0.5">Progres penyelesaian task {periodLabels[period]} terakhir</p>
              </div>
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                {(["30d", "7d", "24h"] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                      period === p
                        ? "bg-white dark:bg-gray-700 text-brand shadow-sm"
                        : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                  >
                    {periodLabels[p]}
                  </button>
                ))}
              </div>
            </div>
            {filteredTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={filteredTrends}>
                  <defs>
                    <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6C4EF5" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#6C4EF5" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#12B76A" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#12B76A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return `${d.getDate()}/${d.getMonth() + 1}`;
                    }}
                    interval={period === "24h" ? 0 : "preserveStartEnd"}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--chart-tooltip)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelFormatter={(v) => new Date(v).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" })}
                  />
                  <Area type="monotone" dataKey="created" stroke="#12B76A" fill="url(#createdGrad)" strokeWidth={2} name="Dibuat" />
                    <Area type="monotone" dataKey="completed" stroke="#6C4EF5" fill="url(#completedGrad)" strokeWidth={2} name="Selesai" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-gray-400 text-sm">
                Belum ada data task untuk ditampilkan
              </div>
            )}
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <Trophy size={18} className="text-yellow-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top Kontributor</h2>
            </div>
            {stats && stats.topContributors.length > 0 ? (
              <div className="space-y-4">
                {stats.topContributors.map((c, i) => (
                  <div key={c.userId}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          i === 0 ? "bg-yellow-100 text-yellow-600" :
                          i === 1 ? "bg-gray-100 text-gray-500" :
                          i === 2 ? "bg-orange-100 text-orange-600" :
                          "bg-gray-50 text-gray-400"
                        }`}>
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{c.name}</span>
                      </div>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">{c.completedCount}</span>
                    </div>
                    <ProgressBar value={c.completedCount} max={stats.topContributors[0].completedCount} color="bg-yellow-400" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm">
                Belum ada task selesai
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <Layers size={18} className="text-brand" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Distribusi Task per Kolom</h2>
            </div>
            {stats && stats.tasksPerColumn.length > 0 ? (
              <div className="space-y-3">
                {stats.tasksPerColumn.map((tc) => (
                  <div key={tc.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{tc.name}</span>
                      <span className="text-xs font-medium text-gray-500">
                        {tc.count} task <span className="text-gray-400">({tc.percentage}%)</span>
                      </span>
                    </div>
                    <ProgressBar value={tc.count} max={Math.max(...stats.tasksPerColumn.map(t => t.count))} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm">
                Belum ada task
              </div>
            )}
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-brand" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Task Terbaru</h2>
              </div>
              {stats && stats.recentTasks.length > 0 && (
                <button
                  onClick={() => {
                    if (stats.recentTasks[0]) navigate(`/board/${stats.recentTasks[0].boardId}`);
                  }}
                  className="text-xs text-brand hover:underline flex items-center gap-1"
                >
                  Lihat semua <ArrowRight size={12} />
                </button>
              )}
            </div>
            {stats && stats.recentTasks.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      <th className="text-left pb-2 font-medium text-gray-400 text-xs uppercase">Task</th>
                      <th className="text-left pb-2 font-medium text-gray-400 text-xs uppercase">Board</th>
                      <th className="text-left pb-2 font-medium text-gray-400 text-xs uppercase hidden sm:table-cell">Assignee</th>
                      <th className="text-left pb-2 font-medium text-gray-400 text-xs uppercase hidden md:table-cell">Deadline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentTasks.slice(0, 5).map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => navigate(`/board/${t.boardId}`)}
                        className="border-b border-gray-50 dark:border-gray-800 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
                      >
                        <td className="py-2.5 pr-3">
                          <span className="text-gray-800 dark:text-gray-200 font-medium">{t.title}</span>
                          <span className="block text-xs text-gray-400">{t.columnName}</span>
                        </td>
                        <td className="py-2.5 pr-3 text-gray-500 text-xs">{t.boardName}</td>
                        <td className="py-2.5 pr-3 hidden sm:table-cell">
                          {t.assignees.length > 0 ? (
                            <div className="flex -space-x-1.5">
                              {t.assignees.slice(0, 3).map((a) => (
                                <div
                                  key={a.id}
                                  className="w-6 h-6 rounded-full bg-brand text-white text-[10px] font-medium flex items-center justify-center ring-2 ring-white dark:ring-gray-800"
                                  title={a.name}
                                >
                                  {a.name.charAt(0)}
                                </div>
                              ))}
                              {t.assignees.length > 3 && (
                                <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 text-[10px] font-medium flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
                                  +{t.assignees.length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 hidden md:table-cell">
                          {t.dueDate ? (
                            <span className={`text-xs font-medium ${
                              new Date(t.dueDate) < new Date() ? "text-red-500" :
                              new Date(t.dueDate).getTime() - Date.now() < 86400000 ? "text-yellow-500" :
                              "text-gray-500"
                            }`}>
                              {new Date(t.dueDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm">
                Belum ada task
              </div>
            )}
          </div>
        </div>

      </div>
    </Layout>
  );
}
