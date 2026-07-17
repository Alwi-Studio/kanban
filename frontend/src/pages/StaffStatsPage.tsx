import { useEffect, useMemo, useState } from "react";
import { Radio, Users, Trophy, CalendarDays, Database, Download, MessageSquare, Clock, AlertCircle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import Layout from "../components/Layout/Layout";
import StatCard from "../components/ui/StatCard";
import { getStaffStatistics } from "../services/statistics";
import type { StaffStatistics, StaffStatsRange, StaffStatsChartPoint, StaffStatsEntry } from "../types";

const numberFormatter = new Intl.NumberFormat();

function formatDuration(milliseconds: number) {
  const totalMinutes = Math.floor(Number(milliseconds) / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatBytes(bytes: number) {
  const value = Number(bytes);
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = value;
  let unit = -1;
  do {
    size /= 1024;
    unit += 1;
  } while (size >= 1024 && unit < units.length - 1);
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unit]}`;
}

function chartDateLabel(point: StaffStatsChartPoint, range: StaffStatsRange) {
  if (range === "month") return `Day ${point.day}`;
  return new Date(point.year, point.month - 1, point.day).toLocaleDateString(undefined, {
    weekday: range === "week" ? "short" : undefined,
    month: "short",
    day: "numeric",
  });
}

function periodLabel(period: { year: number; month: number }) {
  return new Date(period.year, period.month - 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

const RANGE_LABELS: Record<StaffStatsRange, string> = {
  month: "the selected month",
  today: "today",
  day: "the selected date range",
  week: "the selected week",
};

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv(statistics: StaffStatistics) {
  if (!statistics?.top?.length) return;
  const period = statistics.selectedPeriod ? periodLabel(statistics.selectedPeriod) : "No period";
  const summaryRows = [
    ["Metric", "Value"],
    ["Tracked Staff", Number(statistics.summary.totalStaff || 0)],
    ["Total Points", Number(statistics.summary.totalPoints || 0)],
    ["Total Chat Messages", Number(statistics.summary.totalChat || 0)],
    ["Total Activity", formatDuration(statistics.summary.totalActivity || 0)],
    ["Tracked Days", Number(statistics.summary.trackedDays || 0)],
    ["Database Storage", formatBytes(statistics.storageBytes || 0)],
  ];
  const leaderboardRows = [
    ["Rank", "Staff Member", "Points", "Activity", "Chat Messages"],
    ...statistics.top.map((activity, index) => [
      index + 1,
      activity.name || "Unknown staff member",
      Number(activity.points || 0),
      formatDuration(activity.lastActivity || 0),
      Number(activity.amountChat || 0),
    ]),
  ];
  const csv = [
    ["Staff Activity"],
    ["Period", period],
    ["Range", RANGE_LABELS[statistics.selectedRange]],
    ["Generated", new Date(statistics.generatedAt).toLocaleString()],
    [],
    ["Statistics Summary"],
    ...summaryRows,
    [],
    ["Leaderboard"],
    ...leaderboardRows,
  ].map(row => row.map(csvCell).join(",")).join("\r\n");

  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const selectedPeriod = statistics.selectedPeriod
    ? `${statistics.selectedPeriod.year}-${String(statistics.selectedPeriod.month).padStart(2, "0")}`
    : "no-period";
  link.href = url;
  link.download = `staff-activity-${selectedPeriod}-${statistics.selectedRange}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

interface Controls {
  range: StaffStatsRange;
  year: number | null;
  month: number | null;
  dateFrom: string;
  dateTo: string;
  week: number;
}

const RANGE_OPTIONS: { value: StaffStatsRange; label: string }[] = [
  { value: "month", label: "Whole month" },
  { value: "today", label: "Today" },
  { value: "day", label: "Date range" },
  { value: "week", label: "Week of month" },
];

export default function StaffStatsPage() {
  const [data, setData] = useState<StaffStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [controls, setControls] = useState<Controls>({ range: "month", year: null, month: null, dateFrom: "", dateTo: "", week: 1 });

  const load = async (next: Controls) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const stats = await getStaffStatistics({
        range: next.range,
        year: next.year ?? undefined,
        month: next.month ?? undefined,
        dateFrom: next.range === "day" ? next.dateFrom || undefined : undefined,
        dateTo: next.range === "day" ? next.dateTo || undefined : undefined,
        week: next.range === "week" ? next.week : undefined,
      });
      setData(stats);
      // Reconcile control state with what the server actually resolved.
      setControls(current => ({
        ...current,
        range: stats.selectedRange,
        year: stats.selectedPeriod?.year ?? current.year,
        month: stats.selectedPeriod?.month ?? current.month,
        dateFrom: stats.selectedDateFrom || current.dateFrom,
        dateTo: stats.selectedDateTo || current.dateTo,
        week: stats.selectedWeek || current.week,
      }));
    } catch (error: any) {
      const payload = error?.response?.data;
      setErrorMsg(payload?.detail || payload?.error || error?.message || "Could not load staff statistics.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(controls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availablePeriods = useMemo(() => {
    if (!data) return [];
    const periods = [...data.periods];
    if (data.selectedPeriod && !periods.some(p => p.year === data.selectedPeriod!.year && p.month === data.selectedPeriod!.month)) {
      periods.unshift(data.selectedPeriod);
    }
    return periods;
  }, [data]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.chart.map(point => ({
      label: chartDateLabel(point, data.selectedRange),
      points: Number(point.points),
      hours: Number(point.activityTime) / 3600000,
    }));
  }, [data]);

  const onRangeChange = (range: StaffStatsRange) => {
    const next: Controls = { ...controls, range };
    if (range === "today") {
      const today = new Date();
      next.year = today.getFullYear();
      next.month = today.getMonth() + 1;
    }
    if (range === "day" && !next.dateFrom) {
      next.dateFrom = localDateValue();
      next.dateTo = localDateValue();
    }
    setControls(next);
    load(next);
  };

  const onPeriodChange = (value: string) => {
    const [year, month] = value.split("-").map(Number);
    const next: Controls = { ...controls, year, month, dateFrom: "", dateTo: "" };
    if (next.range === "today") next.range = "month";
    setControls(next);
    load(next);
  };

  const setField = (patch: Partial<Controls>) => {
    const next = { ...controls, ...patch };
    setControls(next);
    load(next);
  };

  const rangeSuffix = data ? RANGE_LABELS[data.selectedRange] : RANGE_LABELS[controls.range];
  const periodValue = controls.year && controls.month ? `${controls.year}-${controls.month}` : "";
  const daysInMonth = controls.year && controls.month ? new Date(controls.year, controls.month, 0).getDate() : 31;
  const weekCount = Math.ceil(daysInMonth / 7);
  const monthMin = controls.year && controls.month ? `${controls.year}-${String(controls.month).padStart(2, "0")}-01` : undefined;
  const monthMax = controls.year && controls.month ? `${controls.year}-${String(controls.month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}` : undefined;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Radio size={22} className="text-brand" /> Staff Online
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Staff activity leaderboard &amp; trends {data?.selectedPeriod ? `— ${periodLabel(data.selectedPeriod)}` : ""}
            </p>
          </div>
          <button
            onClick={() => data && downloadCsv(data)}
            disabled={!data || data.top.length === 0}
            className="btn-primary text-sm inline-flex items-center gap-2 self-start sm:self-auto disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={15} /> Export CSV
          </button>
        </div>

        {errorMsg && (
          <div className="card border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">Statistics are unavailable</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{errorMsg}</p>
              <button onClick={() => load(controls)} className="text-xs text-red-700 dark:text-red-300 font-medium hover:underline mt-2">Try again</button>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="card p-4 flex flex-wrap items-center gap-2">
          <select
            value={periodValue}
            onChange={e => onPeriodChange(e.target.value)}
            disabled={loading || availablePeriods.length === 0}
            aria-label="Activity month"
            className="rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm outline-none text-gray-700 dark:text-gray-200 disabled:opacity-50"
          >
            {availablePeriods.length === 0 && <option value="">No months</option>}
            {availablePeriods.map(p => (
              <option key={`${p.year}-${p.month}`} value={`${p.year}-${p.month}`}>{periodLabel(p)}</option>
            ))}
          </select>

          <select
            value={controls.range}
            onChange={e => onRangeChange(e.target.value as StaffStatsRange)}
            disabled={loading}
            aria-label="Activity range"
            className="rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm outline-none text-gray-700 dark:text-gray-200 disabled:opacity-50"
          >
            {RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {controls.range === "day" && (
            <>
              <input
                type="date"
                value={controls.dateFrom}
                min={monthMin}
                max={monthMax}
                onChange={e => setField({ dateFrom: e.target.value, dateTo: controls.dateTo && controls.dateTo < e.target.value ? e.target.value : controls.dateTo })}
                aria-label="Activity start date"
                className="rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm outline-none text-gray-700 dark:text-gray-200"
              />
              <input
                type="date"
                value={controls.dateTo}
                min={controls.dateFrom || monthMin}
                max={monthMax}
                onChange={e => setField({ dateTo: e.target.value })}
                aria-label="Activity end date"
                className="rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm outline-none text-gray-700 dark:text-gray-200"
              />
            </>
          )}

          {controls.range === "week" && (
            <select
              value={controls.week}
              onChange={e => setField({ week: Number(e.target.value) })}
              disabled={loading}
              aria-label="Week of month"
              className="rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm outline-none text-gray-700 dark:text-gray-200 disabled:opacity-50"
            >
              {Array.from({ length: weekCount }, (_, i) => <option key={i + 1} value={i + 1}>{`Week ${i + 1}`}</option>)}
            </select>
          )}

          <span className="text-xs text-gray-400 ml-auto">
            {loading ? "Loading…" : data ? `Updated ${new Date(data.generatedAt).toLocaleString()}` : ""}
          </span>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Tracked Staff" value={data ? numberFormatter.format(data.summary.totalStaff) : "—"} icon={<Users size={20} />} />
          <StatCard label="Total Points" value={data ? numberFormatter.format(data.summary.totalPoints) : "—"} icon={<Trophy size={20} />} color="success" />
          <StatCard label="Tracked Days" value={data ? numberFormatter.format(data.summary.trackedDays) : "—"} icon={<CalendarDays size={20} />} color="brand" />
          <StatCard label="DB Storage" value={data ? formatBytes(data.storageBytes) : "—"} icon={<Database size={20} />} color="brand" />
        </div>

        {/* Chart */}
        <div className="card p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Daily Activity</h2>
            <p className="text-xs text-gray-400 mt-0.5">Points and activity time for {rangeSuffix}</p>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="staffPointsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6C4EF5" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#6C4EF5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="staffHoursGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#12B76A" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#12B76A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9CA3AF" }} interval="preserveStartEnd" />
                <YAxis yAxisId="points" tick={{ fontSize: 11, fill: "#9CA3AF" }} allowDecimals={false} />
                <YAxis yAxisId="hours" orientation="right" tick={{ fontSize: 11, fill: "#9CA3AF" }} tickFormatter={(v) => `${Number(v).toFixed(1)}h`} />
                <Tooltip
                  contentStyle={{ background: "var(--chart-tooltip)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(value: any, name: any) => name === "Activity Hours" ? [`${Number(value).toFixed(1)} h`, name] : [numberFormatter.format(Math.round(Number(value))), name]}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Area yAxisId="points" type="monotone" dataKey="points" name="Points" stroke="#6C4EF5" fill="url(#staffPointsGrad)" strokeWidth={2.5} />
                <Area yAxisId="hours" type="monotone" dataKey="hours" name="Activity Hours" stroke="#12B76A" fill="url(#staffHoursGrad)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">{loading ? "Loading chart…" : "No activity data for this period"}</div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={18} className="text-yellow-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top Staff Activity</h2>
          </div>
          <p className="text-xs text-gray-400 mb-5">Ranked by points for {rangeSuffix}</p>
          {data && data.top.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-400 text-xs uppercase">
                    <th className="text-left pb-2 font-medium w-10">#</th>
                    <th className="text-left pb-2 font-medium">Staff Member</th>
                    <th className="text-right pb-2 font-medium"><span className="inline-flex items-center gap-1 justify-end"><MessageSquare size={11} /> Chat</span></th>
                    <th className="text-right pb-2 font-medium"><span className="inline-flex items-center gap-1 justify-end"><Clock size={11} /> Activity</span></th>
                    <th className="text-right pb-2 font-medium">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top.map((entry: StaffStatsEntry, index) => (
                    <tr key={entry.uuid} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                      <td className="py-2.5">
                        <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold ${
                          index === 0 ? "bg-yellow-100 text-yellow-600" :
                          index === 1 ? "bg-gray-100 text-gray-500" :
                          index === 2 ? "bg-orange-100 text-orange-600" :
                          "bg-gray-50 text-gray-400 dark:bg-gray-800"
                        }`}>{index + 1}</span>
                      </td>
                      <td className="py-2.5 font-medium text-gray-800 dark:text-gray-200">{entry.name || "Unknown staff member"}</td>
                      <td className="py-2.5 text-right text-gray-500">{numberFormatter.format(entry.amountChat)}</td>
                      <td className="py-2.5 text-right text-gray-500">{formatDuration(entry.lastActivity)}</td>
                      <td className="py-2.5 text-right font-semibold text-gray-900 dark:text-white">{numberFormatter.format(entry.points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[160px] text-gray-400 text-sm">{loading ? "Loading staff activity…" : "No staff activity found."}</div>
          )}
        </div>
      </div>
    </Layout>
  );
}
