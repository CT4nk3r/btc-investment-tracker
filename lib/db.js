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
    date: row.trade_date,
    raw: row.raw || "",
    buyAmount: Number(row.buy_amount),
    buyAsset: row.buy_asset,
    sellAmount: Number(row.sell_amount),
    sellAsset: row.sell_asset,
    note: row.note || "",
    createdAt: row.created_at,
  };
}
