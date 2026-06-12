import { describe, expect, it } from "vitest";
import {
  buildImportPreview,
  cleanExportRow,
  formatCurrency,
  normalizeImportedRows,
  parseCsv,
  parseJsonRows,
  parseTrade,
} from "../lib/ledger.js";

describe("ledger parsing", () => {
  it("parses natural BTC and stablecoin buy phrases", () => {
    expect(parseTrade("I bought 100 usdc for 89 euro")).toEqual({
      buyAmount: 100,
      buyAsset: "USDC",
      sellAmount: 89,
      sellAsset: "EUR",
    });

    expect(parseTrade("I bought 0.002 btc for 80 usdc")).toEqual({
      buyAmount: 0.002,
      buyAsset: "BTC",
      sellAmount: 80,
      sellAsset: "USDC",
    });
  });

  it("parses spent/paid wording and common aliases", () => {
    expect(parseTrade("I spent 10 bucks on 0.001 bittcoin")).toEqual({
      buyAmount: 0.001,
      buyAsset: "BTC",
      sellAmount: 10,
      sellAsset: "USD",
    });

    expect(parseTrade("paid 3900 forint for 10 usd coin")).toEqual({
      buyAmount: 10,
      buyAsset: "USDC",
      sellAmount: 3900,
      sellAsset: "HUF",
    });

    expect(parseTrade("Bought 0,002 bitcion with 80 tether")).toEqual({
      buyAmount: 0.002,
      buyAsset: "BTC",
      sellAmount: 80,
      sellAsset: "USDT",
    });
  });

  it("rejects unsupported assets and malformed phrases", () => {
    expect(parseTrade("I bought pizza")).toBeNull();
    expect(parseTrade("I bought 10 xyz for 9 euro")).toBeNull();
  });
});

describe("import/export", () => {
  const row = {
    id: "row-1",
    date: "2026-06-01",
    buyAmount: 100,
    buyAsset: "USDC",
    sellAmount: 89,
    sellAsset: "EUR",
    note: "bank card",
    raw: "I bought 100 usdc for 89 euro",
    createdAt: "2026-06-01T01:00:00.000Z",
  };

  it("accepts current JSON backup format", () => {
    const backup = JSON.stringify({ schemaVersion: 1, rows: [row] });
    expect(parseJsonRows(backup)).toEqual([row]);
  });

  it("accepts older raw JSON arrays", () => {
    expect(parseJsonRows(JSON.stringify([row]))).toEqual([row]);
  });

  it("parses CSV exports with quoted text", () => {
    const csv = [
      "id,date,buy_amount,buy_asset,sell_amount,sell_asset,unit_price,note,raw,created_at",
      '"row-1","2026-06-01","100","USDC","89","EUR","0.89","bank card","I bought 100 usdc for 89 euro","2026-06-01T01:00:00.000Z"',
    ].join("\n");

    expect(parseCsv(csv)[0]).toMatchObject({
      id: "row-1",
      date: "2026-06-01",
      buy_amount: "100",
      buy_asset: "USDC",
      sell_amount: "89",
      sell_asset: "EUR",
    });
  });

  it("normalizes rows and reports invalid imports", () => {
    const result = normalizeImportedRows([row, { ...row }, { date: "nope" }], []);
    expect(result.validRows).toHaveLength(1);
    expect(result.duplicateInFileCount).toBe(1);
    expect(result.invalidRows).toHaveLength(1);
  });

  it("accepts internal balancing assets used by wallet imports", () => {
    const result = normalizeImportedRows([
      {
        ...row,
        id: "wallet-row",
        buyAsset: "USDC",
        sellAsset: "EXTERNAL_WALLET",
      },
    ]);

    expect(result.invalidRows).toHaveLength(0);
    expect(result.validRows[0].sellAsset).toBe("EXTERNAL_WALLET");
  });

  it("builds an import preview with existing duplicate detection", () => {
    const preview = buildImportPreview(JSON.stringify({ rows: [row] }), "backup.json", [row]);
    expect(preview.validRows).toHaveLength(1);
    expect(preview.duplicateExistingCount).toBe(1);
  });

  it("exports only portable row fields", () => {
    expect(cleanExportRow({ ...row, userId: "secret", updatedAt: "ignored" })).toEqual(row);
  });

  it("formats supported base currencies", () => {
    expect(formatCurrency(584.48, "EUR")).toContain("584.48");
    expect(formatCurrency(677, "USD")).toContain("677");
  });
});
