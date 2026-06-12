import { describe, expect, it } from "vitest";
import {
  btcEquivalentBuyCount,
  btcEquivalentCostEur,
  btcEquivalentHeld,
  fiatSpentIntoCrypto,
} from "../lib/portfolio-metrics.js";

describe("portfolio metrics", () => {
  it("treats wrapped BTC as BTC-equivalent", () => {
    expect(btcEquivalentHeld({ BTC: 0.1, WBTC: 0.02 })).toBeCloseTo(0.12);
    expect(btcEquivalentBuyCount([{ buyAsset: "WBTC" }, { buyAsset: "BTC" }, { buyAsset: "USDC" }])).toBe(2);
    expect(btcEquivalentCostEur({ BTC: [{ amount: 1, costEur: 10 }], WBTC: [{ amount: 1, costEur: 20 }] })).toBe(30);
  });

  it("counts only fiat-funded crypto purchases", () => {
    expect(
      fiatSpentIntoCrypto([
        { buyAsset: "EURC", sellAsset: "EUR", sellAmount: 100 },
        { buyAsset: "USDC", sellAsset: "EURC", sellAmount: 100 },
        { buyAsset: "WBTC", sellAsset: "USDC", sellAmount: 100 },
        { buyAsset: "USD", sellAsset: "EUR", sellAmount: 50 },
      ]),
    ).toEqual({ EUR: 100 });
  });
});
