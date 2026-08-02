import { Router } from "express";
import mysql, { Pool, RowDataPacket } from "mysql2/promise";
import { authenticate } from "../middlewares/auth";
import { AppError } from "../middlewares/errorHandler";

export const rewardLogsRouter = Router();

const NETWORKS = ["alwination", "minegens"] as const;
type Network = typeof NETWORKS[number];

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const pools = new Map<Network, Pool>();

function queryString(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" ? value : undefined;
}

function positiveInteger(value: string | undefined, fallback: number, maximum?: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return maximum ? Math.min(parsed, maximum) : parsed;
}

function selectedNetwork(value: string | undefined): Network {
  const normalized = (value || "alwination").toLowerCase();
  if (!NETWORKS.includes(normalized as Network)) {
    throw new AppError(400, "network must be alwination or minegens");
  }
  return normalized as Network;
}

function networkUrl(network: Network): string | undefined {
  return process.env[`REWARDCORE_${network.toUpperCase()}_MYSQL_URL`];
}

function rewardTable(): string {
  const name = process.env.REWARDCORE_TABLE || "rewardcore_reward_log";
  if (!IDENTIFIER_PATTERN.test(name)) {
    throw new AppError(500, "REWARDCORE_TABLE must be a valid MySQL identifier");
  }
  return `\`${name}\``;
}

function poolFor(network: Network): Pool {
  const existing = pools.get(network);
  if (existing) return existing;

  const uri = networkUrl(network);
  if (!uri) {
    throw new AppError(503, `${network === "alwination" ? "AlwiNation" : "MineGens"} RewardCore database is not configured`);
  }

  const pool = mysql.createPool({
    uri,
    connectionLimit: 4,
    enableKeepAlive: true,
    connectTimeout: 5000,
    supportBigNumbers: true,
    bigNumberStrings: true,
  });
  pools.set(network, pool);
  return pool;
}

function normalizeBenefits(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

rewardLogsRouter.get("/", authenticate, async (req, res) => {
  try {
    const network = selectedNetwork(queryString(req.query.network));
    const page = positiveInteger(queryString(req.query.page), 1);
    const limit = positiveInteger(queryString(req.query.limit), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = (page - 1) * limit;
    const search = (queryString(req.query.search) || "").trim().slice(0, 100);
    const table = rewardTable();
    const pool = poolFor(network);

    const searchColumns = ["executor_name", "target_name", "executor_uuid", "target_uuid", "invoice_id", "source", "type", "product"];
    const where = search
      ? `WHERE ${searchColumns.map(column => `\`${column}\` LIKE ?`).join(" OR ")}`
      : "";
    const searchParameters = searchColumns.map(() => `%${search}%`);

    const [rows, countRows] = await Promise.all([
      pool.query<RowDataPacket[]>(
        `SELECT id, executed_at, executor_uuid, executor_name, target_uuid, target_name,
          invoice_id, source, type, product, amount, rank_set, applied, failed, benefits
        FROM ${table}
        ${where}
        ORDER BY id DESC
        LIMIT ? OFFSET ?`,
        [...searchParameters, limit, offset],
      ),
      pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM ${table} ${where}`,
        searchParameters,
      ),
    ]);

    const total = Number(countRows[0][0]?.total || 0);
    res.setHeader("Cache-Control", "private, no-store");
    return res.json({
      network,
      entries: rows[0].map(row => ({ ...row, benefits: normalizeBenefits(row.benefits) })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message, code: "REWARD_LOG_REQUEST_ERROR" });
    }
    console.error("Unable to load RewardCore logs", error);
    return res.status(500).json({
      error: "Unable to load RewardCore logs",
      code: error.code || "REWARD_LOG_API_ERROR",
      detail: error.message || "Unknown database error",
    });
  }
});
