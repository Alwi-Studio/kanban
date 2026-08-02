import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Copy, Database,
  Download, Inbox, RefreshCw, Search, SlidersHorizontal, X,
} from "lucide-react";
import Layout from "../components/Layout/Layout";
import { useToast } from "../components/ui/Toast";
import { getRewardLogs } from "../services/rewardLogs";
import type { RewardLogEntry, RewardLogNetwork, RewardLogResponse } from "../types";

const NETWORKS: { id: RewardLogNetwork; label: string }[] = [
  { id: "alwination", label: "AlwiNation" },
  { id: "minegens", label: "MineGens" },
];

const PAGE_SIZES = [25, 50, 100];
const DEFAULT_PAGE_SIZE = 50;
const numberFormatter = new Intl.NumberFormat();

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["minute", 60], ["hour", 3600], ["day", 86400],
];
const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

/** Short "3 hours ago" label; falls back to a calendar date once the entry is older than a week. */
function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "—";
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds >= 604800) return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  let [unit, divisor] = RELATIVE_UNITS[0];
  for (const [candidateUnit, candidateDivisor] of RELATIVE_UNITS) {
    if (seconds >= candidateDivisor) [unit, divisor] = [candidateUnit, candidateDivisor];
  }
  return relativeFormatter.format(-Math.floor(seconds / divisor), unit);
}

function prettyJson(value: unknown) {
  if (value == null) return "";
  if (typeof value !== "string") return JSON.stringify(value, null, 2);
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function benefitSummary(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(item => (typeof item === "string" ? item : JSON.stringify(item)));
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key}: ${typeof item === "object" ? JSON.stringify(item) : String(item)}`);
  return [String(value)];
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(entries: RewardLogEntry[], network: RewardLogNetwork, page: number) {
  const header = ["ID", "Executed at", "Executor", "Executor UUID", "Target", "Target UUID", "Invoice ID", "Source", "Type", "Product", "Amount", "Rank set", "Applied", "Failed", "Benefits"];
  const rows = entries.map(entry => [
    entry.id, entry.executed_at, entry.executor_name, entry.executor_uuid || "", entry.target_name, entry.target_uuid,
    entry.invoice_id || "", entry.source, entry.type, entry.product, entry.amount ?? "", entry.rank_set ?? "",
    entry.applied, entry.failed, typeof entry.benefits === "string" ? entry.benefits : JSON.stringify(entry.benefits ?? ""),
  ]);
  const csv = [header, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `reward-logs-${network}-page-${page}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function StatusPill({ applied, failed }: { applied: number; failed: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex min-w-[26px] justify-center rounded-md bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-green-700 dark:bg-green-900/30 dark:text-green-300" title={`${applied} applied`}>{applied}</span>
      <span className={`inline-flex min-w-[26px] justify-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${failed > 0 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"}`} title={`${failed} failed`}>{failed}</span>
    </span>
  );
}

function Identity({ name, uuid, fallback }: { name: string; uuid: string | null; fallback?: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-xs font-medium text-gray-800 dark:text-gray-200">{name || fallback || "—"}</div>
      <div className="truncate font-mono text-[10px] text-gray-400" title={uuid || undefined}>{uuid || fallback || "—"}</div>
    </div>
  );
}

function CopyButton({ value, label, onCopied }: { value: string; label: string; onCopied: (label: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard?.writeText(value); onCopied(label); }}
      className="shrink-0 rounded-md p-1 text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-gray-800 dark:hover:text-gray-200"
      title={`Copy ${label.toLowerCase()}`}
      aria-label={`Copy ${label.toLowerCase()}`}
    >
      <Copy size={12} />
    </button>
  );
}

function DetailField({ label, value, copyable, onCopied }: { label: string; value: string; copyable?: boolean; onCopied: (label: string) => void }) {
  return (
    <div className="group flex items-start justify-between gap-2 border-b border-gray-100 py-2 last:border-0 dark:border-gray-800">
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</span>
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate text-right text-xs text-gray-800 dark:text-gray-200" title={value}>{value || "—"}</span>
        {copyable && value && value !== "—" && <CopyButton value={value} label={label} onCopied={onCopied} />}
      </span>
    </div>
  );
}

function DetailDrawer({ entry, onClose, onCopied }: { entry: RewardLogEntry; onClose: () => void; onCopied: (label: string) => void }) {
  const json = prettyJson(entry.benefits);
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] animate-fade-in" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Reward log ${entry.id}`}
        className="relative flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl animate-slide-right dark:border-gray-800 dark:bg-[#141418]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div>
            <div className="eyebrow">Entry #{entry.id}</div>
            <h2 className="mt-1 text-base font-bold text-gray-900 dark:text-white">{entry.product}</h2>
            <p className="mt-0.5 text-xs text-gray-400">{formatDate(entry.executed_at)}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200" aria-label="Close details">
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto scrollbar-thin px-5 py-3">
          <DetailField label="Type" value={entry.type} onCopied={onCopied} />
          <DetailField label="Source" value={entry.source} onCopied={onCopied} />
          <DetailField label="Amount" value={entry.amount ?? "—"} onCopied={onCopied} />
          <DetailField label="Rank set" value={entry.rank_set ?? "—"} onCopied={onCopied} />
          <DetailField label="Invoice ID" value={entry.invoice_id ?? "—"} copyable onCopied={onCopied} />
          <DetailField label="Executor" value={entry.executor_name || "Console"} onCopied={onCopied} />
          <DetailField label="Executor UUID" value={entry.executor_uuid ?? "—"} copyable onCopied={onCopied} />
          <DetailField label="Target" value={entry.target_name} onCopied={onCopied} />
          <DetailField label="Target UUID" value={entry.target_uuid} copyable onCopied={onCopied} />

          <div className="mt-4 flex items-center gap-3">
            <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Result</span>
            <StatusPill applied={entry.applied} failed={entry.failed} />
            {entry.failed > 0 && <span className="text-[11px] font-medium text-red-500">{entry.failed} benefit{entry.failed === 1 ? "" : "s"} failed to apply</span>}
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Benefits</span>
              {json && (
                <button
                  onClick={() => { navigator.clipboard?.writeText(json); onCopied("Benefits JSON"); }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-brand"
                >
                  <Copy size={11} /> Copy JSON
                </button>
              )}
            </div>
            {json ? (
              <pre className="max-h-80 overflow-auto scrollbar-thin whitespace-pre-wrap rounded-xl border border-gray-200 bg-gray-50 p-3 font-mono text-[11px] leading-5 text-gray-700 dark:border-gray-800 dark:bg-[#0b0b0e] dark:text-gray-300">{json}</pre>
            ) : (
              <p className="text-xs text-gray-400">No benefits recorded.</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function SkeletonRows({ rows, columns }: { rows: number; columns: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-gray-100 dark:border-gray-800">
          {Array.from({ length: columns }, (_, cellIndex) => (
            <td key={cellIndex} className="px-3 py-3">
              <div className="h-3 animate-pulse rounded bg-gray-200/80 dark:bg-gray-800" style={{ width: `${45 + ((rowIndex * 7 + cellIndex * 13) % 45)}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function RewardLogsPage() {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);

  const network: RewardLogNetwork = params.get("network") === "minegens" ? "minegens" : "alwination";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const search = params.get("q") || "";
  const limitParam = Number(params.get("limit"));
  const limit = PAGE_SIZES.includes(limitParam) ? limitParam : DEFAULT_PAGE_SIZE;

  const [searchInput, setSearchInput] = useState(search);
  const [data, setData] = useState<RewardLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<RewardLogEntry | null>(null);

  const update = useCallback((patch: Record<string, string | null>) => {
    setParams(current => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") next.delete(key);
        else next.set(key, value);
      }
      return next;
    }, { replace: true });
  }, [setParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getRewardLogs({ network, page, limit, search: search || undefined })
      .then(result => { if (active) setData(result); })
      .catch(err => {
        if (!active) return;
        setData(null);
        setError(err?.response?.data?.detail || err?.response?.data?.error || "Could not load RewardCore logs.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [network, page, limit, search, reloadKey]);

  // Debounce typing into the search box so every keystroke does not hit MySQL.
  useEffect(() => {
    if (searchInput.trim() === search) return;
    const timer = setTimeout(() => update({ q: searchInput.trim() || null, page: null }), 400);
    return () => clearTimeout(timer);
  }, [searchInput, search, update]);

  // "/" focuses search, Escape closes the drawer or clears the query.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key !== "Escape") return;
      if (selected) setSelected(null);
      else if (searchInput) { setSearchInput(""); searchRef.current?.blur(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, searchInput]);

  const pagination = data?.pagination;
  const entries = data?.entries ?? [];

  // A deleted tail (or a narrower search) can leave the page pointer past the end.
  useEffect(() => {
    if (pagination && page > pagination.totalPages) update({ page: String(pagination.totalPages) });
  }, [pagination, page, update]);

  const pageStats = useMemo(() => entries.reduce(
    (totals, entry) => ({ applied: totals.applied + Number(entry.applied || 0), failed: totals.failed + Number(entry.failed || 0) }),
    { applied: 0, failed: 0 },
  ), [entries]);

  const firstIndex = pagination && pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const lastIndex = pagination ? Math.min(pagination.page * pagination.limit, pagination.total) : 0;
  const goToPage = (next: number) => update({ page: next <= 1 ? null : String(next) });
  const onCopied = (label: string) => toast(`${label} copied`, "success");

  return (
    <Layout flush>
      <div className="flex h-full min-h-0 flex-col">
        {/* Header + controls */}
        <div className="border-b border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-[#141418] sm:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="eyebrow">RewardCore</div>
              <h1 className="mt-1 flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
                <Database size={20} className="text-brand" /> <span className="text-gradient">Reward logs</span>
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800" role="group" aria-label="Reward network">
                {NETWORKS.map(item => (
                  <button
                    key={item.id}
                    onClick={() => update({ network: item.id === "alwination" ? null : item.id, page: null })}
                    aria-pressed={network === item.id}
                    className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${network === item.id ? "bg-white text-brand shadow-sm dark:bg-gray-700 dark:text-brand-200" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 sm:flex-none">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={searchRef}
                  value={searchInput}
                  onChange={event => setSearchInput(event.target.value)}
                  placeholder="Search player, invoice, product…"
                  aria-label="Search reward logs"
                  className="input w-full py-1.5 pl-8 pr-8 text-xs sm:w-72"
                />
                {searchInput ? (
                  <button onClick={() => setSearchInput("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" aria-label="Clear search">
                    <X size={13} />
                  </button>
                ) : (
                  <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-gray-200 px-1 text-[10px] text-gray-400 dark:border-gray-600 sm:block">/</kbd>
                )}
              </div>

              <button onClick={() => setReloadKey(value => value + 1)} disabled={loading} className="btn-secondary px-3 py-1.5 text-xs" title="Refresh logs">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
              <button
                onClick={() => downloadCsv(entries, network, page)}
                disabled={entries.length === 0}
                className="btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                title="Export the entries on this page"
              >
                <Download size={14} /> Export
              </button>
            </div>
          </div>

          {/* Result summary */}
          {!error && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
              <span>
                {pagination ? (
                  <>Showing <strong className="font-semibold text-gray-700 dark:text-gray-200">{numberFormatter.format(firstIndex)}–{numberFormatter.format(lastIndex)}</strong> of {numberFormatter.format(pagination.total)} entries</>
                ) : "Loading entries…"}
              </span>
              {search && (
                <button onClick={() => setSearchInput("")} className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 font-medium text-brand hover:bg-brand/20">
                  “{search}” <X size={11} />
                </button>
              )}
              {entries.length > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  This page: <StatusPill applied={pageStats.applied} failed={pageStats.failed} /> applied / failed
                </span>
              )}
              {data && <span className="ml-auto">Updated {new Date(data.generatedAt).toLocaleTimeString()}</span>}
            </div>
          )}
        </div>

        {/* Body */}
        {error ? (
          <div className="m-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/10 sm:m-6">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">Reward logs are unavailable</p>
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{error}</p>
              <button onClick={() => setReloadKey(value => value + 1)} className="mt-2 text-xs font-medium text-red-700 hover:underline dark:text-red-300">Try again</button>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto scrollbar-thin">
            {/* Desktop table */}
            <table className="hidden w-full min-w-[1100px] border-collapse text-left lg:table">
              <thead className="sticky top-0 z-10 bg-gray-50/95 text-[10px] uppercase tracking-wide text-gray-400 backdrop-blur dark:bg-gray-900/95">
                <tr>
                  <th className="w-[70px] whitespace-nowrap border-b border-gray-200 px-3 py-2 font-semibold dark:border-gray-700">ID</th>
                  <th className="w-[150px] whitespace-nowrap border-b border-gray-200 px-3 py-2 font-semibold dark:border-gray-700">Executed</th>
                  <th className="w-[180px] border-b border-gray-200 px-3 py-2 font-semibold dark:border-gray-700">Executor</th>
                  <th className="w-[180px] border-b border-gray-200 px-3 py-2 font-semibold dark:border-gray-700">Target</th>
                  <th className="w-[140px] border-b border-gray-200 px-3 py-2 font-semibold dark:border-gray-700">Source / Type</th>
                  <th className="border-b border-gray-200 px-3 py-2 font-semibold dark:border-gray-700">Product</th>
                  <th className="w-[90px] whitespace-nowrap border-b border-gray-200 px-3 py-2 text-right font-semibold dark:border-gray-700">Amount</th>
                  <th className="w-[110px] whitespace-nowrap border-b border-gray-200 px-3 py-2 text-center font-semibold dark:border-gray-700">Applied / Failed</th>
                  <th className="w-[40px] border-b border-gray-200 px-3 py-2 dark:border-gray-700"><span className="sr-only">Details</span></th>
                </tr>
              </thead>
              <tbody>
                {loading && entries.length === 0 ? (
                  <SkeletonRows rows={12} columns={9} />
                ) : (
                  entries.map(entry => (
                    <tr
                      key={entry.id}
                      onClick={() => setSelected(entry)}
                      tabIndex={0}
                      onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(entry); } }}
                      className={`group cursor-pointer border-b border-gray-100 align-middle transition last:border-0 hover:bg-brand/[0.04] dark:border-gray-800 dark:hover:bg-brand/10 ${loading ? "opacity-50" : ""} ${entry.failed > 0 ? "bg-red-50/40 dark:bg-red-900/10" : ""}`}
                    >
                      <td className="px-3 py-2 font-mono text-[11px] font-semibold text-gray-500 dark:text-gray-400">{entry.id}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-[11px] text-gray-600 dark:text-gray-300" title={formatDate(entry.executed_at)}>
                        {relativeTime(entry.executed_at)}
                      </td>
                      <td className="px-3 py-2"><Identity name={entry.executor_name} uuid={entry.executor_uuid} fallback="Console" /></td>
                      <td className="px-3 py-2"><Identity name={entry.target_name} uuid={entry.target_uuid} /></td>
                      <td className="px-3 py-2">
                        <div className="truncate text-[11px] text-gray-600 dark:text-gray-300">{entry.source}</div>
                        <span className="mt-0.5 inline-block rounded bg-brand/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand dark:text-brand-200">{entry.type}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="truncate text-xs font-medium text-gray-800 dark:text-gray-200">{entry.product}</div>
                        <div className="truncate text-[10px] text-gray-400">
                          {[entry.rank_set, entry.invoice_id && `#${entry.invoice_id}`, benefitSummary(entry.benefits).slice(0, 2).join(", ")].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[11px] tabular-nums text-gray-700 dark:text-gray-300">{entry.amount ?? "—"}</td>
                      <td className="px-3 py-2 text-center"><StatusPill applied={entry.applied} failed={entry.failed} /></td>
                      <td className="px-3 py-2 text-gray-300 transition group-hover:text-brand dark:text-gray-600"><ChevronRight size={15} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Mobile / tablet cards */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800 lg:hidden">
              {loading && entries.length === 0
                ? Array.from({ length: 6 }, (_, index) => (
                    <div key={index} className="space-y-2 px-4 py-3">
                      <div className="h-3 w-1/3 animate-pulse rounded bg-gray-200/80 dark:bg-gray-800" />
                      <div className="h-3 w-2/3 animate-pulse rounded bg-gray-200/80 dark:bg-gray-800" />
                    </div>
                  ))
                : entries.map(entry => (
                    <button
                      key={entry.id}
                      onClick={() => setSelected(entry)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-brand/[0.04] dark:hover:bg-brand/10 ${loading ? "opacity-50" : ""} ${entry.failed > 0 ? "bg-red-50/40 dark:bg-red-900/10" : ""}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{entry.product}</span>
                          <span className="shrink-0 rounded bg-brand/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-brand dark:text-brand-200">{entry.type}</span>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                          {entry.target_name} · {entry.source}{entry.amount ? ` · ${entry.amount}` : ""}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-400">
                          <span title={formatDate(entry.executed_at)}>{relativeTime(entry.executed_at)}</span>
                          <StatusPill applied={entry.applied} failed={entry.failed} />
                        </div>
                      </div>
                      <ChevronRight size={16} className="mt-1 shrink-0 text-gray-300 dark:text-gray-600" />
                    </button>
                  ))}
            </div>

            {!loading && entries.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
                <Inbox size={28} className="text-gray-300 dark:text-gray-700" />
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No reward logs found</p>
                <p className="max-w-xs text-xs text-gray-400">
                  {search ? `Nothing matches “${search}” on ${NETWORKS.find(item => item.id === network)?.label}.` : "This network has not recorded any rewards yet."}
                </p>
                {search && <button onClick={() => setSearchInput("")} className="btn-secondary mt-2 px-3 py-1.5 text-xs">Clear search</button>}
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {!error && pagination && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-white px-4 py-2 text-xs text-gray-500 dark:border-gray-800 dark:bg-[#141418] dark:text-gray-400 sm:px-6">
            <label className="inline-flex items-center gap-2">
              <SlidersHorizontal size={13} className="text-gray-400" />
              <span className="hidden sm:inline">Rows per page</span>
              <select
                value={limit}
                onChange={event => update({ limit: event.target.value === String(DEFAULT_PAGE_SIZE) ? null : event.target.value, page: null })}
                className="rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-xs outline-none dark:border-gray-700"
              >
                {PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>

            <div className="flex items-center gap-1">
              <span className="mr-2 tabular-nums">Page {pagination.page} of {pagination.totalPages}</span>
              <button onClick={() => goToPage(1)} disabled={loading || pagination.page <= 1} className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 disabled:opacity-30 dark:border-gray-700 dark:hover:bg-gray-800" aria-label="First page"><ChevronsLeft size={15} /></button>
              <button onClick={() => goToPage(pagination.page - 1)} disabled={loading || pagination.page <= 1} className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 disabled:opacity-30 dark:border-gray-700 dark:hover:bg-gray-800" aria-label="Previous page"><ChevronLeft size={15} /></button>
              <button onClick={() => goToPage(pagination.page + 1)} disabled={loading || pagination.page >= pagination.totalPages} className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 disabled:opacity-30 dark:border-gray-700 dark:hover:bg-gray-800" aria-label="Next page"><ChevronRight size={15} /></button>
              <button onClick={() => goToPage(pagination.totalPages)} disabled={loading || pagination.page >= pagination.totalPages} className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 disabled:opacity-30 dark:border-gray-700 dark:hover:bg-gray-800" aria-label="Last page"><ChevronsRight size={15} /></button>
            </div>
          </div>
        )}
      </div>

      {selected && <DetailDrawer entry={selected} onClose={() => setSelected(null)} onCopied={onCopied} />}
    </Layout>
  );
}
