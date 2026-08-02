import { useEffect, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Database, RefreshCw, Search } from "lucide-react";
import Layout from "../components/Layout/Layout";
import { getRewardLogs } from "../services/rewardLogs";
import type { RewardLogEntry, RewardLogNetwork, RewardLogResponse } from "../types";

const NETWORKS: { id: RewardLogNetwork; label: string }[] = [
  { id: "alwination", label: "AlwiNation" },
  { id: "minegens", label: "MineGens" },
];

function compactUuid(value: string | null) {
  if (!value) return "—";
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function JsonCell({ value }: { value: unknown }) {
  if (value == null) return <span className="text-gray-400">—</span>;
  const formatted = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const summary = typeof value === "string" ? value : JSON.stringify(value);
  return (
    <details className="group min-w-[150px] max-w-[260px]">
      <summary className="cursor-pointer list-none truncate rounded-md bg-gray-100 px-2 py-1 font-mono text-[10px] text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700" title={summary}>
        {summary}
      </summary>
      <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-2 text-[10px] leading-4 text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300">{formatted}</pre>
    </details>
  );
}

function StatusCount({ value, tone }: { value: number; tone: "green" | "red" }) {
  return <span className={`inline-flex min-w-6 justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tone === "green" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}>{value}</span>;
}

function LogRow({ entry }: { entry: RewardLogEntry }) {
  return (
    <tr className="border-b border-gray-100 align-top last:border-0 hover:bg-gray-50/80 dark:border-gray-800 dark:hover:bg-gray-800/40">
      <td className="px-3 py-2 font-mono text-[11px] font-semibold text-gray-700 dark:text-gray-200">{entry.id}</td>
      <td className="whitespace-nowrap px-3 py-2 text-[11px] text-gray-500 dark:text-gray-400">{formatDate(entry.executed_at)}</td>
      <td className="px-3 py-2"><div className="text-xs font-medium text-gray-800 dark:text-gray-200">{entry.executor_name}</div><div className="font-mono text-[10px] text-gray-400" title={entry.executor_uuid || "Console"}>{entry.executor_uuid ? compactUuid(entry.executor_uuid) : "Console"}</div></td>
      <td className="px-3 py-2"><div className="text-xs font-medium text-gray-800 dark:text-gray-200">{entry.target_name}</div><div className="font-mono text-[10px] text-gray-400" title={entry.target_uuid}>{compactUuid(entry.target_uuid)}</div></td>
      <td className="px-3 py-2 font-mono text-[10px] text-gray-500 dark:text-gray-400">{entry.invoice_id || "—"}</td>
      <td className="whitespace-nowrap px-3 py-2 text-[11px] text-gray-600 dark:text-gray-300">{entry.source}</td>
      <td className="px-3 py-2"><span className="rounded-md bg-brand/10 px-2 py-1 text-[10px] font-semibold uppercase text-brand dark:text-brand-200">{entry.type}</span></td>
      <td className="px-3 py-2 text-xs font-medium text-gray-800 dark:text-gray-200">{entry.product}</td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[11px] text-gray-700 dark:text-gray-300">{entry.amount ?? "—"}</td>
      <td className="whitespace-nowrap px-3 py-2 text-[11px] text-gray-600 dark:text-gray-300">{entry.rank_set || "—"}</td>
      <td className="px-3 py-2 text-center"><StatusCount value={entry.applied} tone="green" /></td>
      <td className="px-3 py-2 text-center"><StatusCount value={entry.failed} tone="red" /></td>
      <td className="px-3 py-2"><JsonCell value={entry.benefits} /></td>
    </tr>
  );
}

export default function RewardLogsPage() {
  const [network, setNetwork] = useState<RewardLogNetwork>("alwination");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<RewardLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getRewardLogs({ network, page, limit: 50, search: search || undefined })
      .then(result => { if (active) setData(result); })
      .catch(err => {
        if (!active) return;
        setData(null);
        setError(err?.response?.data?.detail || err?.response?.data?.error || "Could not load RewardCore logs.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [network, page, search, reloadKey]);

  const selectNetwork = (next: RewardLogNetwork) => {
    setNetwork(next);
    setPage(1);
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const pagination = data?.pagination;

  return (
    <Layout flush>
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-[#141418] sm:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="eyebrow">RewardCore</div>
              <h1 className="mt-1 flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white"><Database size={20} className="text-brand" /> Reward logs</h1>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800" aria-label="Reward network">
                {NETWORKS.map(item => (
                  <button key={item.id} onClick={() => selectNetwork(item.id)} className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${network === item.id ? "bg-white text-brand shadow-sm dark:bg-gray-700 dark:text-brand-200" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"}`}>{item.label}</button>
                ))}
              </div>
              <form onSubmit={submitSearch} className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Search player, invoice, product…" className="input w-full py-1.5 pl-8 pr-3 text-xs sm:w-64" />
              </form>
              <button onClick={() => setReloadKey(value => value + 1)} disabled={loading} className="btn-secondary px-3 py-1.5" title="Refresh logs"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh</button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="m-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/10 sm:m-6">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
            <div><p className="text-sm font-semibold text-red-700 dark:text-red-300">Reward logs are unavailable</p><p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{error}</p></div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto scrollbar-thin">
            <table className="min-w-[1580px] w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-gray-50/95 text-[10px] uppercase tracking-wide text-gray-400 backdrop-blur dark:bg-gray-900/95">
                <tr>{["ID", "Executed at", "Executor / UUID", "Target / UUID", "Invoice ID", "Source", "Type", "Product", "Amount", "Rank set", "Applied", "Failed", "Benefits JSON"].map(label => <th key={label} className="whitespace-nowrap border-b border-gray-200 px-3 py-2 font-semibold dark:border-gray-700">{label}</th>)}</tr>
              </thead>
              <tbody className={loading ? "opacity-50" : ""}>
                {data?.entries.map(entry => <LogRow key={entry.id} entry={entry} />)}
              </tbody>
            </table>
            {!loading && data?.entries.length === 0 && <div className="flex h-48 items-center justify-center text-sm text-gray-400">No reward logs found.</div>}
            {loading && !data && <div className="flex h-48 items-center justify-center text-sm text-gray-400"><RefreshCw size={16} className="mr-2 animate-spin" /> Loading reward logs…</div>}
          </div>
        )}

        {!error && pagination && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-2 text-xs text-gray-500 dark:border-gray-800 dark:bg-[#141418] dark:text-gray-400 sm:px-6">
            <span>{pagination.total.toLocaleString()} entries · page {pagination.page} of {pagination.totalPages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(value => Math.max(1, value - 1))} disabled={loading || pagination.page <= 1} className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 disabled:opacity-30 dark:border-gray-700 dark:hover:bg-gray-800" aria-label="Previous page"><ChevronLeft size={15} /></button>
              <button onClick={() => setPage(value => Math.min(pagination.totalPages, value + 1))} disabled={loading || pagination.page >= pagination.totalPages} className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 disabled:opacity-30 dark:border-gray-700 dark:hover:bg-gray-800" aria-label="Next page"><ChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
