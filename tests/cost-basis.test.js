import { describe, expect, it } from "vitest";
import { calculateLots, summarizeLotBasis } from "../lib/cost-basis.js";

function row(id, date, buyAmount, buyAsset, sellAmount, sellAsset) {
  return {
    id,
    date,
    buyAmount,
    buyAsset,
    sellAmount,
    sellAsset,
    createdAt: `${date}T12:00:00.000Z`,
  };
}

describe("cost basis", () => {
  it("shows the consideration asset when EUR ancestry is unknown", () => {
    const rows = [
      row("receive-usdc", "2026-06-01", 100, "USDC", 100, "EXTERNAL_WALLET"),
      row("buy-wbtc", "2026-06-02", 0.00164219, "WBTC", 100, "USDC"),
    ];

    const lots = calculateLots(rows);
    expect(summarizeLotBasis(lots.pools.WBTC)).toEqual({ USDC: 100 });
    expect(lots.pools.WBTC[0].costEur).toBeUndefined();
  });

  it("preserves EUR basis through stablecoin and WBTC swaps", () => {
    const rows = [
      row("buy-usdc", "2026-06-01", 100, "USDC", 90, "EUR"),
      row("buy-wbtc", "2026-06-02", 0.00164219, "WBTC", 100, "USDC"),
    ];

    const lots = calculateLots(rows);
    expect(lots.pools.WBTC[0].costEur).toBe(90);
    expect(summarizeLotBasis(lots.pools.WBTC)).toEqual({ EUR: 90 });
  });

  it("keeps genuinely unknown external deposits unknown", () => {
    const lots = calculateLots([
      row("receive-usdc", "2026-06-01", 100, "USDC", 100, "EXTERNAL_WALLET"),
    ]);

    expect(summarizeLotBasis(lots.pools.USDC)).toEqual({});
  });
});
