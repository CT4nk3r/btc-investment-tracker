import { FIAT } from "./ledger.js";

export const BTC_EQUIVALENTS = new Set(["BTC", "WBTC"]);

export function btcEquivalentBuyCount(rows) {
  return rows.filter((row) => BTC_EQUIVALENTS.has(row.buyAsset)).length;
}

export function btcEquivalentHeld(balances) {
  return [...BTC_EQUIVALENTS].reduce((sum, asset) => sum + (balances[asset] || 0), 0);
}

export function btcEquivalentCostEur(pools) {
  return [...BTC_EQUIVALENTS].reduce(
    (sum, asset) =>
      sum +
      (pools[asset] || [])
        .filter((lot) => lot.amount > 0)
        .reduce((assetSum, lot) => assetSum + (lot.costEur || 0), 0),
    0,
  );
}

export function fiatSpentIntoCrypto(rows) {
  return rows.reduce((spent, row) => {
    if (!FIAT.includes(row.sellAsset) || FIAT.includes(row.buyAsset)) return spent;
    spent[row.sellAsset] = (spent[row.sellAsset] || 0) + row.sellAmount;
    return spent;
  }, {});
}
