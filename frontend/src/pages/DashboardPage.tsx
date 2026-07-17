import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, ListTodo, CheckCircle2, AlertCircle, Trophy, Layers, Clock, ArrowRight, TrendingUp, TrendingDown, Radio, Users, CalendarDays, Target } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getDashboardStats } from "../services/board";
import { getStaffStatistics } from "../services/statistics";
import StatCard from "../components/ui/StatCard";
import Layout from "../components/Layout/Layout";
import type { DashboardStats, StaffStatistics } from "../types";

const numberFormatter = new Intl.NumberFormat();

function formatStaffDuration(milliseconds: number) {
  const totalMinutes = Math.floor(Number(milliseconds) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

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
  const [staffStats, setStaffStats] = useState<StaffStatistics | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffLoading, setStaffLoading] = useState(true);

  const loadStats = () => {
    setLoading(true);
    setError(false);
    getDashboardStats()
      .then(setStats)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(loadStats, []);

  useEffect(() => {
    setStaffLoading(true);
    getStaffStatistics({ range: "month", limit: 5 })
      .then((data) => { setStaffStats(data); setStaffError(null); })
      .catch((err) => { setStaffStats(null); setStaffError(err?.response?.data?.error || "Staff statistics unavailable"); })
      .finally(() => setStaffLoading(false));
  }, []);

  const staffChartData = (staffStats?.chart ?? []).map((point) => ({
    label: `Day ${point.day}`,
    points: Number(point.points),
  }));

  // The whole dashboard follows the toggle: `view` is either the personal scope
  // (tasks assigned to me) or the organization scope (all accessible boards).
  const view = stats ? (statsView === "personal" ? stats.personal : stats) : null;

  const filteredTrends = (() => {
    if (!view) return [];
    const days = period === "30d" ? 30 : period === "7d" ? 7 : 1;
    return view.taskTrends.slice(-days);
  })();

  const periodLabels: Record<Period, string> = {
    "30d": "30 days",
    "7d": "7 days",
    "24h": "24 hours",
  };
  const summary = view;

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

  // Personal-view signature: a completion ring answering "how much of my work is done?"
  const completionRing = (() => {
    const total = view?.totalTasks ?? 0;
    const done = view?.completedTasks ?? 0;
    const overdue = view?.overdueTasks ?? 0;
    const remaining = Math.max(0, total - done);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const circumference = 2 * Math.PI * 52;
    const dashOffset = circumference * (1 - pct / 100);
    return (
      <div className="card p-6 flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <Target size={18} className="text-brand" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Completion Rate</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">Your finished tasks out of everything assigned</p>
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="relative w-[150px] h-[150px]">
            <svg width="150" height="150" viewBox="0 0 150 150" className="-rotate-90">
              <circle cx="75" cy="75" r="52" fill="none" strokeWidth="13" className="stroke-gray-100 dark:stroke-gray-800" />
              <circle cx="75" cy="75" r="52" fill="none" strokeWidth="13" stroke="#6C4EF5" strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={dashOffset} style={{ transition: "stroke-dashoffset 0.7s ease" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{pct}%</span>
              <span className="text-[11px] text-gray-400">{done} of {total} done</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 w-full mt-6">
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3 text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">{remaining}</div>
              <div className="text-[10px] uppercase tracking-wide text-gray-400">Remaining</div>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3 text-center">
              <div className={`text-lg font-bold ${overdue ? "text-red-500" : "text-gray-900 dark:text-white"}`}>{overdue}</div>
              <div className="text-[10px] uppercase tracking-wide text-gray-400">Overdue</div>
            </div>
          </div>
        </div>
      </div>
    );
  })();

  const distributionCard = (title: string, subtitle: string) => (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-1">
        <Layers size={18} className="text-brand" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
      </div>
      <p className="text-xs text-gray-400 mb-4">{subtitle}</p>
      {view && view.tasksPerColumn.length > 0 ? (
        <div className="space-y-3">
          {view.tasksPerColumn.map((tc) => (
            <div key={tc.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-700 dark:text-gray-300">{tc.name}</span>
                <span className="text-xs font-medium text-gray-500">
                  {tc.count} {tc.count === 1 ? "task" : "tasks"} <span className="text-gray-400">({tc.percentage}%)</span>
                </span>
              </div>
              <ProgressBar value={tc.count} max={Math.max(...view.tasksPerColumn.map(t => t.count))} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm">No tasks yet</div>
      )}
    </div>
  );

  const recentTasksCard = (title: string, subtitle: string) => (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-brand" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        </div>
        {view && view.recentTasks.length > 0 && (
          <button
            onClick={() => { if (view.recentTasks[0]) navigate(`/board/${view.recentTasks[0].boardId}`); }}
            className="text-xs text-brand hover:underline flex items-center gap-1"
          >
            View all <ArrowRight size={12} />
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-4">{subtitle}</p>
      {view && view.recentTasks.length > 0 ? (
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
              {view.recentTasks.slice(0, 5).map((t) => (
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
                        {new Date(t.dueDate).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
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
        <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm">No tasks yet</div>
      )}
    </div>
  );

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

        <div className="flex items-center gap-2 pt-1"><span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" /><span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{statsView === "personal" ? "Your workflow" : "Overall workflow"}</span><span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" /></div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Task Progress Over Time</h2>
                <p className="text-xs text-gray-400 mt-0.5">Task completion over the last {periodLabels[period]}</p>
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
                    labelFormatter={(v) => new Date(v).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short" })}
                  />
                  <Area type="monotone" dataKey="created" stroke="#12B76A" fill="url(#createdGrad)" strokeWidth={2} name="Created" />
                    <Area type="monotone" dataKey="completed" stroke="#6C4EF5" fill="url(#completedGrad)" strokeWidth={2} name="Completed" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-gray-400 text-sm">
                No task data to display
              </div>
            )}
          </div>

          {statsView === "personal" ? completionRing : (
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={18} className="text-yellow-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top Contributors</h2>
            </div>
            <p className="text-xs text-gray-400 mb-4">Who's completing the most tasks</p>
            {view && view.topContributors.length > 0 ? (
              <div className="space-y-4">
                {view.topContributors.map((c, i) => (
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
                    <ProgressBar value={c.completedCount} max={view.topContributors[0].completedCount} color="bg-yellow-400" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm">
                No completed tasks yet
              </div>
            )}
          </div>
          )}
        </div>

        {statsView === "personal" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">{recentTasksCard("My Tasks", "Your assigned tasks, newest first")}</div>
            {distributionCard("Where My Tasks Sit", "Your tasks across columns")}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {distributionCard("Task Distribution by Column", "How work is spread across boards")}
            {recentTasksCard("Recent Tasks", "Latest activity across your boards")}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1"><span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" /><span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Staff online</span><span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" /></div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Radio size={18} className="text-brand" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Staff Activity Overview</h2>
              {staffStats?.selectedPeriod && (
                <span className="text-xs text-gray-400 hidden sm:inline">· {new Date(staffStats.selectedPeriod.year, staffStats.selectedPeriod.month - 1).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
              )}
            </div>
            <button onClick={() => navigate("/staff")} className="text-xs text-brand hover:underline flex items-center gap-1">
              View all <ArrowRight size={12} />
            </button>
          </div>

          {staffLoading ? (
            <div className="flex items-center justify-center h-[220px] text-gray-400 text-sm">Loading staff activity…</div>
          ) : staffError ? (
            <div className="flex flex-col items-center justify-center h-[220px] text-center gap-2">
              <p className="text-sm text-gray-400">{staffError}</p>
              <button onClick={() => navigate("/staff")} className="text-xs text-brand hover:underline">Open Staff Online</button>
            </div>
          ) : staffStats ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
                    <div className="flex items-center gap-1.5 text-gray-400 mb-1"><Users size={13} /><span className="text-[10px] uppercase tracking-wide font-medium">Staff</span></div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">{numberFormatter.format(staffStats.summary.totalStaff)}</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
                    <div className="flex items-center gap-1.5 text-gray-400 mb-1"><Trophy size={13} /><span className="text-[10px] uppercase tracking-wide font-medium">Points</span></div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">{numberFormatter.format(staffStats.summary.totalPoints)}</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
                    <div className="flex items-center gap-1.5 text-gray-400 mb-1"><CalendarDays size={13} /><span className="text-[10px] uppercase tracking-wide font-medium">Days</span></div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">{numberFormatter.format(staffStats.summary.trackedDays)}</div>
                  </div>
                </div>
                {staffChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={staffChartData}>
                      <defs>
                        <linearGradient id="staffOverviewGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6C4EF5" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#6C4EF5" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9CA3AF" }} interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9CA3AF" }} width={32} />
                      <Tooltip contentStyle={{ background: "var(--chart-tooltip)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", borderRadius: "8px", fontSize: "12px" }} />
                      <Area type="monotone" dataKey="points" name="Points" stroke="#6C4EF5" fill="url(#staffOverviewGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[180px] text-gray-400 text-sm">No activity this period</div>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy size={16} className="text-yellow-500" />
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Top Staff</h3>
                </div>
                {staffStats.top.length > 0 ? (
                  <div className="space-y-3">
                    {staffStats.top.slice(0, 5).map((entry, i) => (
                      <div key={entry.uuid} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            i === 0 ? "bg-yellow-100 text-yellow-600" :
                            i === 1 ? "bg-gray-100 text-gray-500" :
                            i === 2 ? "bg-orange-100 text-orange-600" :
                            "bg-gray-50 text-gray-400 dark:bg-gray-800"
                          }`}>{i + 1}</span>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{entry.name || "Unknown"}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-semibold text-gray-900 dark:text-white">{numberFormatter.format(entry.points)} pts</div>
                          <div className="text-[10px] text-gray-400">{formatStaffDuration(entry.lastActivity)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[160px] text-gray-400 text-sm">No staff activity</div>
                )}
              </div>
            </div>
          ) : null}
        </div>

      </div>
    </Layout>
  );
}
