import { Router, Request } from "express";
import mysql from "mysql2/promise";
import { authenticate } from "../middlewares/auth";
import { AppError } from "../middlewares/errorHandler";

// Staff-activity statistics, ported from the standalone StatisticWebsite so the
// kanban app can act as a hub. This reads a *separate* MySQL database (the
// `staffactivity` table) and is entirely independent of the Postgres/Prisma DB
// that powers the rest of the app.
export const statisticsRouter = Router();

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const ACTIVITY_RANGES = new Set(["month", "today", "day", "week"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ACTIVITY_POINT_INTERVAL = 60000;
const ACTIVITY_POINTS_PER_INTERVAL = 2;

type Range = "month" | "today" | "day" | "week";

function queryString(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" ? value : undefined;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new AppError(500, `Missing required environment variable: ${name}`);
  return value;
}

function identifier(name: string, fallback: string): string {
  const value = process.env[name] || fallback;
  if (!IDENTIFIER_PATTERN.test(value)) throw new AppError(500, `${name} must be a valid MySQL identifier`);
  return `\`${value}\``;
}

function identifierValue(name: string, fallback: string): string {
  const value = process.env[name] || fallback;
  if (!IDENTIFIER_PATTERN.test(value)) throw new AppError(500, `${name} must be a valid MySQL identifier`);
  return value;
}

function leaderboardLimit(req: Request): number {
  const requested = Number.parseInt(queryString(req.query.limit) ?? "", 10);
  if (!Number.isFinite(requested)) return DEFAULT_LIMIT;
  return Math.min(Math.max(requested, 1), MAX_LIMIT);
}

function positiveInteger(value: string | undefined, name: string, maximum?: number): number | null {
  if (value === undefined || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || (maximum && parsed > maximum)) {
    throw new AppError(400, `${name} must be a valid positive integer`);
  }
  return parsed;
}

function optionalPositiveInteger(value: string | undefined, name: string, maximum?: number): number | null {
  if (value === undefined || value === "" || value === "undefined" || value === "null" || value === "NaN") return null;
  return positiveInteger(value, name, maximum);
}

function activityRange(value: string | undefined): Range {
  const range = (value || "month") as Range;
  if (!ACTIVITY_RANGES.has(range)) throw new AppError(400, "range must be month, today, day, or week");
  return range;
}

function activityDate(value: string | undefined, name: string, range: Range): string | null {
  if (range !== "day") return null;
  if (!DATE_PATTERN.test(value || "")) throw new AppError(400, `${name} must use the YYYY-MM-DD format`);
  return value as string;
}

function activityWeek(value: string | undefined, range: Range): number | null {
  if (range !== "week") return null;
  return positiveInteger(value, "week", 5) || 1;
}

// True only when a dedicated MySQL statistics database has been configured. We
// deliberately never fall back to the app's Postgres DATABASE_URL.
function statsConfigured(): boolean {
  return Boolean(process.env.STATS_MYSQL_URL || (process.env.MYSQL_HOST && process.env.MYSQL_USER && process.env.MYSQL_DATABASE));
}

async function openConnection() {
  const common = {
    enableKeepAlive: true,
    connectTimeout: 5000,
    supportBigNumbers: true,
    bigNumberStrings: true,
  } as const;

  if (process.env.STATS_MYSQL_URL) {
    return mysql.createConnection({ uri: process.env.STATS_MYSQL_URL, ...common });
  }

  return mysql.createConnection({
    ...common,
    host: requiredEnvironment("MYSQL_HOST"),
    port: Number.parseInt(process.env.MYSQL_PORT || "3306", 10),
    user: requiredEnvironment("MYSQL_USER"),
    password: requiredEnvironment("MYSQL_PASSWORD"),
    database: requiredEnvironment("MYSQL_DATABASE"),
    ssl: process.env.MYSQL_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  });
}

statisticsRouter.get("/", authenticate, async (req, res) => {
  if (!statsConfigured()) {
    return res.status(503).json({
      error: "Staff statistics are not configured on this server",
      code: "STATISTICS_NOT_CONFIGURED",
      detail: "Set STATS_MYSQL_URL (or MYSQL_HOST/MYSQL_USER/MYSQL_PASSWORD/MYSQL_DATABASE) to enable the staff activity dashboard.",
    });
  }

  let connection: mysql.Connection | undefined;
  try {
    const tableName = identifierValue("MYSQL_ACTIVITY_TABLE", "staffactivity");
    const table = `\`${tableName}\``;
    const uuidColumn = identifier("MYSQL_UUID_COLUMN", "uuid");
    const nameColumn = identifier("MYSQL_NAME_COLUMN", "name");
    const lastActivityColumn = identifier("MYSQL_LAST_ACTIVITY_COLUMN", "last_activity");
    const amountChatColumn = identifier("MYSQL_AMOUNT_CHAT_COLUMN", "amount_chat");
    const dayColumn = identifier("MYSQL_DAY_COLUMN", "day");
    const monthColumn = identifier("MYSQL_MONTH_COLUMN", "month");
    const yearColumn = identifier("MYSQL_YEAR_COLUMN", "year");
    const pointsExpression = `(
      COALESCE(SUM(${amountChatColumn}), 0)
      + FLOOR(COALESCE(SUM(${lastActivityColumn}), 0) / ${ACTIVITY_POINT_INTERVAL}) * ${ACTIVITY_POINTS_PER_INTERVAL}
    )`;
    const limit = leaderboardLimit(req);
    const requestedMonth = optionalPositiveInteger(queryString(req.query.month), "month", 12);
    const requestedYear = optionalPositiveInteger(queryString(req.query.year), "year");
    const selectedRange = activityRange(queryString(req.query.range));
    const selectedDateFrom = activityDate(queryString(req.query.dateFrom) || queryString(req.query.date), "dateFrom", selectedRange);
    const selectedDateTo = activityDate(queryString(req.query.dateTo) || selectedDateFrom || undefined, "dateTo", selectedRange);
    const selectedWeek = activityWeek(queryString(req.query.week), selectedRange);
    if (selectedDateFrom && selectedDateTo && selectedDateFrom > selectedDateTo) {
      throw new AppError(400, "dateFrom must be before or equal to dateTo");
    }

    connection = await openConnection();

    const [currentPeriodRows] = await connection.query<any[]>(
      `SELECT YEAR(CURRENT_DATE()) AS year, MONTH(CURRENT_DATE()) AS month`,
    );
    const [periodRows] = await connection.query<any[]>(
      `SELECT DISTINCT ${yearColumn} AS year, ${monthColumn} AS month
      FROM ${table}
      ORDER BY ${yearColumn} DESC, ${monthColumn} DESC`,
    );
    const selectedPeriod = selectedRange === "today"
      ? currentPeriodRows[0]
      : requestedMonth && requestedYear
      ? { month: requestedMonth, year: requestedYear }
      : periodRows[0] || null;

    if (!selectedPeriod) {
      res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=300");
      return res.status(200).json({
        summary: { totalStaff: 0, totalChat: 0, totalActivity: 0, totalPoints: 0, trackedDays: 0 },
        top: [],
        chart: [],
        storageBytes: 0,
        periods: [],
        selectedPeriod: null,
        selectedRange,
        selectedDateFrom,
        selectedDateTo,
        selectedWeek,
        generatedAt: new Date().toISOString(),
      });
    }

    const dateExpression = `STR_TO_DATE(CONCAT(${yearColumn}, '-', ${monthColumn}, '-', ${dayColumn}), '%Y-%c-%e')`;
    let periodFilter = `${yearColumn} = ? AND ${monthColumn} = ?`;
    const periodParameters: (string | number)[] = [selectedPeriod.year, selectedPeriod.month];
    if (selectedRange === "today") {
      periodFilter += ` AND ${dateExpression} = CURRENT_DATE()`;
    } else if (selectedRange === "day") {
      periodFilter += ` AND ${dateExpression} BETWEEN ? AND ?`;
      periodParameters.push(selectedDateFrom as string, selectedDateTo as string);
    } else if (selectedRange === "week") {
      const firstDay = ((selectedWeek as number) - 1) * 7 + 1;
      periodFilter += ` AND ${dayColumn} BETWEEN ? AND ?`;
      periodParameters.push(firstDay, firstDay + 6);
    }

    const [summaryRows] = await connection.query<any[]>(
      `SELECT COUNT(DISTINCT ${uuidColumn}) AS totalStaff,
        COALESCE(SUM(${amountChatColumn}), 0) AS totalChat,
        COALESCE(SUM(${lastActivityColumn}), 0) AS totalActivity,
        ${pointsExpression} AS totalPoints,
        COUNT(DISTINCT ${dayColumn}) AS trackedDays
      FROM ${table}
      WHERE ${periodFilter}`,
      periodParameters,
    );
    const [topRows] = await connection.query<any[]>(
      `SELECT ${uuidColumn} AS uuid,
        MAX(${nameColumn}) AS name,
        COALESCE(SUM(${lastActivityColumn}), 0) AS lastActivity,
        COALESCE(SUM(${amountChatColumn}), 0) AS amountChat,
        ${pointsExpression} AS points
      FROM ${table}
      WHERE ${periodFilter}
      GROUP BY ${uuidColumn}
      ORDER BY points DESC, amountChat DESC, lastActivity DESC
      LIMIT ?`,
      [...periodParameters, limit],
    );
    const [chartRows] = await connection.query<any[]>(
      `SELECT ${yearColumn} AS year,
        ${monthColumn} AS month,
        ${dayColumn} AS day,
        COALESCE(SUM(${amountChatColumn}), 0) AS amountChat,
        COALESCE(SUM(${lastActivityColumn}), 0) AS activityTime,
        ${pointsExpression} AS points
      FROM ${table}
      WHERE ${periodFilter}
      GROUP BY ${yearColumn}, ${monthColumn}, ${dayColumn}
      ORDER BY ${yearColumn}, ${monthColumn}, ${dayColumn}`,
      periodParameters,
    );
    const [storageRows] = await connection.query<any[]>(
      `SELECT COALESCE(DATA_LENGTH, 0) + COALESCE(INDEX_LENGTH, 0) AS bytes
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [requiredEnvironment("MYSQL_DATABASE"), tableName],
    );

    const summary = summaryRows[0];
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=300");
    return res.status(200).json({
      summary: {
        totalStaff: Number(summary.totalStaff),
        totalChat: Number(summary.totalChat),
        totalActivity: Number(summary.totalActivity),
        totalPoints: Number(summary.totalPoints),
        trackedDays: Number(summary.trackedDays),
      },
      top: topRows,
      chart: chartRows,
      storageBytes: storageRows[0]?.bytes || 0,
      periods: periodRows,
      selectedPeriod,
      selectedRange,
      selectedDateFrom,
      selectedDateTo,
      selectedWeek,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message, code: "STATISTICS_BAD_REQUEST" });
    }
    console.error("Unable to load staff statistics", error);
    return res.status(500).json({
      error: "Unable to load staff statistics",
      code: error.code || "STATISTICS_API_ERROR",
      detail: error.message || "Unknown database error",
    });
  } finally {
    await connection?.end();
  }
});
