import { neon } from "@neondatabase/serverless";

let sql = null;

export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!sql) {
    sql = neon(process.env.DATABASE_URL);
  }

  return sql;
}

export function dbRowToLedgerRow(row) {
  return {
    id: row.id,
    date: toDateString(row.trade_date),
    raw: row.raw || "",
    buyAmount: Number(row.buy_amount),
    buyAsset: row.buy_asset,
    sellAmount: Number(row.sell_amount),
    sellAsset: row.sell_asset,
    note: row.note || "",
    createdAt: toIsoString(row.created_at),
    sourceMetadata: jsonObject(row.source_metadata),
  };
}

function jsonObject(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function toDateString(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value || "").slice(0, 10);
}

function toIsoString(value) {
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || "") : date.toISOString();
}
