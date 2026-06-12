import { calculateLots, summarizeLotBasis } from "./cost-basis.js";
import { COINGECKO_IDS, INTERNAL_ASSETS, sortRows } from "./ledger.js";
import { WALLET_CHAINS } from "./wallet-transactions.js";

export const TAX_EVIDENCE_SCHEMA_VERSION = 1;

export function buildTaxEvidence({ rows, rates, baseCurrency = "EUR", exportedAt = new Date().toISOString() }) {
  const sortedRows = sortRows(rows);
  const lots = calculateLots(sortedRows);
  const records = sortedRows.map(buildTaxRecord);
  const holdings = buildHoldings(sortedRows, lots.pools, rates, baseCurrency);

  return {
    document: {
      title: "BTC Investment Tracker tax evidence package",
      schemaVersion: TAX_EVIDENCE_SCHEMA_VERSION,
      exportedAt,
      reportingCurrency: baseCurrency,
      recordCount: records.length,
      purpose: "Supporting transaction evidence for tax preparation and accountant review.",
      disclaimer:
        "This package preserves user-entered and imported ledger evidence plus derived calculations. It is not tax advice, an official tax filing, or a substitute for exchange statements and blockchain explorer records.",
      retainedDataLimitations:
        "Historical market prices are not retained. Older wallet imports may contain only recoverable chain and transaction-hash links; new wallet imports retain richer source metadata.",
    },
    methodology: {
      accountingMethod: "FIFO",
      sourceOfTruth:
        "Ledger records are the source of holdings and basis calculations. Wallet imports use deterministic IDs derived from chain and transaction hash.",
      historicalValuation:
        "Historical fiat market values are not fabricated. A fiat basis is included only when the recorded trade chain reaches that fiat asset.",
      liveValuation:
        "Current holdings values use the included export-time rate snapshot and may differ from values at transaction time.",
      rateProviders: ["CoinGecko simple price API", "open.er-api.com EUR foreign-exchange rates"],
      internalAssets: INTERNAL_ASSETS,
    },
    rateSnapshot: rates
      ? {
          updatedAt: rates.updatedAt || null,
          fxBase: "EUR",
          fx: rates.fx || {},
          crypto: rates.crypto || {},
        }
      : null,
    summary: {
      holdings,
      totalCurrentValue: holdings.reduce((sum, holding) => sum + (holding.currentValue || 0), 0),
      reportingCurrency: baseCurrency,
      recordsByType: countBy(records, (record) => record.recordType),
      onChainLinkedRecordCount: records.filter((record) => record.source.evidenceStatus === "on_chain_linked").length,
    },
    records,
  };
}

export function taxEvidenceCsv(evidence) {
  const headers = [
    "record_id",
    "trade_date",
    "tax_year",
    "timestamp_utc",
    "record_type",
    "source_type",
    "chain",
    "transaction_hash",
    "explorer_url",
    "evidence_status",
    "wallet_address",
    "block_number",
    "counterparty",
    "method",
    "transaction_status",
    "fee_json",
    "sent_assets_json",
    "received_assets_json",
    "bought_amount",
    "bought_asset",
    "paid_amount",
    "paid_asset",
    "unit_price",
    "unit_price_asset",
    "description",
    "note",
  ];
  const rows = evidence.records.map((record) => [
    record.recordId,
    record.tradeDate,
    record.taxYear,
    record.timestampUtc,
    record.recordType,
    record.source.type,
    record.source.chain || "",
    record.source.transactionHash || "",
    record.source.explorerUrl || "",
    record.source.evidenceStatus,
    record.source.walletAddress || "",
    record.source.blockNumber || "",
    record.source.counterparty || "",
    record.source.method || "",
    record.source.status || "",
    JSON.stringify(record.source.fee || null),
    JSON.stringify(record.source.sentAssets || []),
    JSON.stringify(record.source.receivedAssets || []),
    record.bought.amount,
    record.bought.asset,
    record.paid.amount,
    record.paid.asset,
    record.unitPrice.amount,
    record.unitPrice.asset,
    record.description,
    record.note,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export async function withIntegrityFingerprint(evidence) {
  const canonical = JSON.stringify(evidence);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return {
    ...evidence,
    integrity: {
      algorithm: "SHA-256",
      scope: "Canonical JSON of this package before the integrity field was added.",
      sha256,
    },
  };
}

function buildTaxRecord(row) {
  const source = walletSource(row);
  return {
    recordId: row.id,
    tradeDate: row.date,
    taxYear: String(row.date || "").slice(0, 4),
    timestampUtc: row.createdAt,
    recordType: recordType(row),
    source,
    bought: { amount: row.buyAmount, asset: row.buyAsset },
    paid: { amount: row.sellAmount, asset: row.sellAsset },
    unitPrice: {
      amount: row.buyAmount ? row.sellAmount / row.buyAmount : null,
      asset: row.sellAsset,
      perAsset: row.buyAsset,
    },
    description: row.raw || "",
    note: row.note || "",
  };
}

function walletSource(row) {
  const metadata = row.sourceMetadata || {};
  if (metadata.sourceType === "wallet_import") {
    return {
      type: "wallet_import",
      chain: metadata.chainId || null,
      transactionHash: metadata.transactionHash || null,
      explorerUrl: metadata.explorerUrl || null,
      importComponent: String(row.id || "").split(":").at(-1) || null,
      evidenceStatus: "on_chain_linked",
      walletAddress: metadata.walletAddress || null,
      blockNumber: metadata.blockNumber || null,
      counterparty: metadata.counterparty || null,
      method: metadata.method || null,
      status: metadata.status || null,
      fee: metadata.fee || null,
      sentAssets: metadata.sentAssets || [],
      receivedAssets: metadata.receivedAssets || [],
    };
  }

  const match = String(row.id || "").match(/^wallet:([^:]+):(0x[a-f0-9]+):(.+)$/i);
  if (!match) {
    return {
      type: "manual_or_file_import",
      chain: null,
      transactionHash: null,
      explorerUrl: null,
      importComponent: null,
      evidenceStatus: "user_recorded",
    };
  }
  const [, chainId, transactionHash, importComponent] = match;
  return {
    type: "wallet_import",
    chain: chainId,
    transactionHash,
    explorerUrl: WALLET_CHAINS[chainId] ? `${WALLET_CHAINS[chainId].explorerUrl}/tx/${transactionHash}` : null,
    importComponent,
    evidenceStatus: "on_chain_linked",
  };
}

function recordType(row) {
  if (row.buyAsset === "NETWORK_FEE") return "network_fee";
  if (row.buyAsset === "EXTERNAL_WALLET") return "outgoing_transfer";
  if (row.sellAsset === "EXTERNAL_WALLET") return "incoming_transfer";
  return "trade";
}

function buildHoldings(rows, pools, rates, baseCurrency) {
  const balances = {};
  for (const row of rows) {
    balances[row.buyAsset] = (balances[row.buyAsset] || 0) + row.buyAmount;
    balances[row.sellAsset] = (balances[row.sellAsset] || 0) - row.sellAmount;
  }

  return Object.entries(balances)
    .filter(([asset, amount]) => !INTERNAL_ASSETS.includes(asset) && Math.abs(amount) > 0.00000001)
    .map(([asset, amount]) => {
      const openLots = pools[asset] || [];
      const costBasisEur = openLots.reduce((sum, lot) => sum + (lot.costEur || 0), 0);
      return {
        asset,
        amount,
        costBasisEur: costBasisEur || null,
        costBasisByAsset: summarizeLotBasis(openLots),
        currentValue: currentValue(asset, amount, rates, baseCurrency),
        currentValueCurrency: baseCurrency,
      };
    });
}

function currentValue(asset, amount, rates, baseCurrency) {
  if (!rates) return null;
  if (asset === baseCurrency) return amount;
  const base = baseCurrency.toLowerCase();
  const cryptoId = COINGECKO_IDS[asset];
  if (cryptoId && rates.crypto?.[cryptoId]?.[base]) return amount * rates.crypto[cryptoId][base];
  if (asset === "EUR") return baseCurrency === "EUR" ? amount : amount * (rates.fx?.USD || 0);
  if (asset === "USD") return baseCurrency === "USD" ? amount : amount / (rates.fx?.USD || 1);
  return null;
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function countBy(items, keyForItem) {
  return items.reduce((counts, item) => {
    const key = keyForItem(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}
