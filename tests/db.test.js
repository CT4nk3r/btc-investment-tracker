import { describe, expect, it } from "vitest";
import { dbRowToLedgerRow } from "../lib/db.js";
import { sortRows } from "../lib/ledger.js";

describe("database ledger serialization", () => {
  it("converts Postgres date objects into API-safe strings", () => {
    const row = dbRowToLedgerRow({
      id: "row-1",
      trade_date: new Date("2026-06-05T00:00:00.000Z"),
      raw: "",
      buy_amount: "1",
      buy_asset: "BTC",
      sell_amount: "100",
      sell_asset: "USDC",
      note: "",
      source_metadata: { sourceType: "wallet_import" },
      created_at: new Date("2026-06-05T12:00:00.000Z"),
    });

    expect(row.date).toBe("2026-06-05");
    expect(row.createdAt).toBe("2026-06-05T12:00:00.000Z");
    expect(row.sourceMetadata).toEqual({ sourceType: "wallet_import" });
    expect(() => sortRows([row])).not.toThrow();
  });

  it("sorts defensively when dates are not strings", () => {
    expect(sortRows([{ date: new Date("2026-06-05") }, { date: "2026-06-06" }])[0].date).toBe("2026-06-06");
  });
});
