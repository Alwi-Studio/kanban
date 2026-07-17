import api from "./api";
import type { StaffStatistics, StaffStatsQuery } from "../types";

// Fetches staff-activity statistics from the kanban backend, which proxies the
// separate MySQL staffactivity database. Throws with a friendly message the UI
// can surface (including the STATISTICS_NOT_CONFIGURED case).
export async function getStaffStatistics(params: StaffStatsQuery = {}): Promise<StaffStatistics> {
  const query: Record<string, string> = { limit: String(params.limit ?? 100) };
  if (params.range) query.range = params.range;
  if (params.year != null) query.year = String(params.year);
  if (params.month != null) query.month = String(params.month);
  if (params.dateFrom) query.dateFrom = params.dateFrom;
  if (params.dateTo) query.dateTo = params.dateTo;
  if (params.week != null) query.week = String(params.week);

  const { data } = await api.get("/statistics", { params: query });
  return data as StaffStatistics;
}
