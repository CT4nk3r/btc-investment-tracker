import { INTERNAL_ASSETS } from "./ledger.js";

export function calculateLots(rows) {
  const pools = {};
  const realized = [];

  for (const row of [...rows].sort(compareRowsAscending)) {
    const fromCost = takeCost(pools, row.sellAsset, row.sellAmount);
    const fallbackBasis =
      fromCost.hasKnownBasis || INTERNAL_ASSETS.includes(row.sellAsset)
        ? {}
        : { [row.sellAsset]: row.sellAmount };
    const basis = fromCost.hasKnownBasis ? fromCost.basis : fallbackBasis;
    const costEur =
      fromCost.costEur > 0 ? fromCost.costEur : row.sellAsset === "EUR" ? row.sellAmount : undefined;

    if (!pools[row.buyAsset]) pools[row.buyAsset] = [];
    pools[row.buyAsset].push({
      amount: row.buyAmount,
      costEur,
      basis,
      sourceId: row.id,
      date: row.date,
    });

    if (fromCost.costEur > 0 && row.sellAsset !== "EUR") {
      realized.push({
        row,
        asset: row.sellAsset,
        disposedAmount: row.sellAmount,
        costEur: fromCost.costEur,
        proceedsEur: costEur,
      });
    }
  }

  return { pools, realized };
}

export function summarizeLotBasis(lots = []) {
  return lots.reduce((summary, lot) => addBasis(summary, lot.basis || {}), {});
}

function takeCost(pools, asset, amount) {
  if (asset === "EUR") {
    return { costEur: amount, basis: { EUR: amount }, hasKnownBasis: true };
  }
  if (!pools[asset]) return { costEur: 0, basis: {}, hasKnownBasis: false };

  let remaining = amount;
  let costEur = 0;
  let basis = {};
  let hasKnownBasis = false;
  for (const lot of pools[asset]) {
    if (remaining <= 0) break;
    const used = Math.min(lot.amount, remaining);
    const ratio = lot.amount ? used / lot.amount : 0;
    costEur += (lot.costEur || 0) * ratio;
    const usedBasis = scaleBasis(lot.basis || {}, ratio);
    basis = addBasis(basis, usedBasis);
    hasKnownBasis = hasKnownBasis || Object.keys(usedBasis).length > 0;
    lot.amount -= used;
    lot.costEur = (lot.costEur || 0) * (1 - ratio);
    lot.basis = scaleBasis(lot.basis || {}, 1 - ratio);
    remaining -= used;
  }
  pools[asset] = pools[asset].filter((lot) => lot.amount > 0.000000000001);
  return { costEur, basis, hasKnownBasis };
}

function addBasis(current, next) {
  const result = { ...current };
  for (const [asset, amount] of Object.entries(next)) {
    result[asset] = (result[asset] || 0) + amount;
  }
  return result;
}

function scaleBasis(basis, ratio) {
  return Object.fromEntries(
    Object.entries(basis)
      .map(([asset, amount]) => [asset, amount * ratio])
      .filter(([, amount]) => amount > 0.000000000001),
  );
}

function compareRowsAscending(a, b) {
  return (
    String(a.date || "").localeCompare(String(b.date || "")) ||
    String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
  );
}
