import { describe, expect, it } from "vitest";
import { buildTaxEvidence, taxEvidenceCsv, withIntegrityFingerprint } from "../lib/tax-export.js";

const rows = [
  {
    id: "wallet:polygon:0xabc:trade",
    date: "2026-06-05",
    createdAt: "2026-06-05T20:21:31.000Z",
    buyAmount: 0.00164219,
    buyAsset: "WBTC",
    sellAmount: 100,
    sellAsset: "USDC",
    raw: "Swapped 100 USDC for 0.00164219 WBTC",
    note: "Imported from Polygon wallet activity (0xabc)",
  },
];

describe("tax evidence export", () => {
  it("preserves source transaction evidence and calculation metadata", () => {
    const evidence = buildTaxEvidence({
      rows,
      baseCurrency: "USD",
      exportedAt: "2026-06-13T00:00:00.000Z",
      rates: {
        updatedAt: "2026-06-13T00:00:00.000Z",
        fx: { USD: 1.16 },
        crypto: { "wrapped-bitcoin": { eur: 54700, usd: 63307 } },
      },
    });

    expect(evidence.document).toMatchObject({
      schemaVersion: 1,
      reportingCurrency: "USD",
      recordCount: 1,
    });
    expect(evidence.records[0]).toMatchObject({
      recordId: "wallet:polygon:0xabc:trade",
      recordType: "trade",
      source: {
        type: "wallet_import",
        chain: "polygon",
        transactionHash: "0xabc",
        explorerUrl: "https://polygonscan.com/tx/0xabc",
        evidenceStatus: "on_chain_linked",
      },
      unitPrice: { amount: 100 / 0.00164219, asset: "USDC", perAsset: "WBTC" },
    });
    expect(evidence.summary.holdings[0]).toMatchObject({
      asset: "WBTC",
      amount: 0.00164219,
      currentValueCurrency: "USD",
    });
  });

  it("produces accountant-friendly CSV columns", () => {
    const csv = taxEvidenceCsv(buildTaxEvidence({ rows }));
    expect(csv).toContain('"transaction_hash"');
    expect(csv).toContain('"wallet_address"');
    expect(csv).toContain('"sent_assets_json"');
    expect(csv).toContain('"tax_year"');
    expect(csv).toContain('"on_chain_linked"');
    expect(csv).toContain('"https://polygonscan.com/tx/0xabc"');
    expect(csv).toContain('"Swapped 100 USDC for 0.00164219 WBTC"');
  });

  it("adds an integrity fingerprint to the evidence package", async () => {
    const evidence = await withIntegrityFingerprint(buildTaxEvidence({ rows }));
    expect(evidence.integrity).toMatchObject({ algorithm: "SHA-256" });
    expect(evidence.integrity.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
