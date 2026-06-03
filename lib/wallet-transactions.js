export const WALLET_CHAINS = {
  ethereum: {
    id: "ethereum",
    name: "Ethereum",
    nativeSymbol: "ETH",
    explorerUrl: "https://etherscan.io",
    blockscoutApiUrl: "https://eth.blockscout.com/api/v2",
  },
  polygon: {
    id: "polygon",
    name: "Polygon",
    nativeSymbol: "POL",
    explorerUrl: "https://polygonscan.com",
    blockscoutApiUrl: "https://polygon.blockscout.com/api/v2",
  },
  base: {
    id: "base",
    name: "Base",
    nativeSymbol: "ETH",
    explorerUrl: "https://basescan.org",
    blockscoutApiUrl: "https://base.blockscout.com/api/v2",
  },
  arbitrum: {
    id: "arbitrum",
    name: "Arbitrum One",
    nativeSymbol: "ETH",
    explorerUrl: "https://arbiscan.io",
    blockscoutApiUrl: "https://arbitrum.blockscout.com/api/v2",
  },
};

export function isEvmAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || "").trim());
}

export function normalizeWalletTransactions({
  address,
  chain,
  normalTransactions = [],
  tokenTransfers = [],
}) {
  const wallet = address.toLowerCase();
  const byHash = new Map();

  for (const transaction of normalTransactions) {
    if (!transaction.hash) continue;
    byHash.set(transaction.hash, createTransaction(transaction, chain));
  }

  for (const transfer of tokenTransfers) {
    if (!transfer.hash) continue;
    if (!byHash.has(transfer.hash)) {
      byHash.set(transfer.hash, createTransaction(transfer, chain));
    }
    const transaction = byHash.get(transfer.hash);
    addFlow(transaction, wallet, {
      from: transfer.from,
      to: transfer.to,
      value: transfer.value,
      decimals: transfer.decimals,
      symbol: transfer.symbol || "TOKEN",
      contractAddress: transfer.contractAddress || null,
    });
  }

  for (const raw of normalTransactions) {
    const transaction = byHash.get(raw.hash);
    if (!transaction || !hasPositiveValue(raw.value)) continue;
    addFlow(transaction, wallet, {
      from: raw.from,
      to: raw.to,
      value: raw.value,
      decimals: 18,
      symbol: chain.nativeSymbol,
      contractAddress: null,
    });
  }

  return [...byHash.values()]
    .map((transaction) => finalizeTransaction(transaction, wallet))
    .filter((transaction) => transaction.timestamp)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function createTransaction(raw, chain) {
  return {
    hash: raw.hash,
    timestamp: normalizeTimestamp(raw.timestamp),
    blockNumber: Number(raw.blockNumber) || null,
    status: raw.status === "error" || raw.status === "0" ? "failed" : "success",
    from: raw.from || null,
    to: raw.to || null,
    method: raw.method || null,
    input: raw.input || null,
    fee: raw.feeWei && hasPositiveValue(raw.feeWei)
      ? {
          amount: formatUnits(raw.feeWei, 18),
          symbol: chain.nativeSymbol,
        }
      : null,
    explorerUrl: `${chain.explorerUrl}/tx/${raw.hash}`,
    sentAssets: [],
    receivedAssets: [],
  };
}

function addFlow(transaction, wallet, asset) {
  const from = String(asset.from || "").toLowerCase();
  const to = String(asset.to || "").toLowerCase();
  if (from !== wallet && to !== wallet) return;

  const flow = {
    amount: formatUnits(asset.value, asset.decimals),
    symbol: asset.symbol,
    contractAddress: asset.contractAddress,
  };
  if (!hasPositiveValue(flow.amount)) return;

  if (from === wallet && to !== wallet) mergeAsset(transaction.sentAssets, flow);
  if (to === wallet && from !== wallet) mergeAsset(transaction.receivedAssets, flow);
}

function mergeAsset(assets, next) {
  const existing = assets.find(
    (asset) =>
      asset.symbol === next.symbol &&
      String(asset.contractAddress || "").toLowerCase() ===
        String(next.contractAddress || "").toLowerCase(),
  );
  if (!existing) {
    assets.push(next);
    return;
  }

  existing.amount = addDecimalStrings(existing.amount, next.amount);
}

function finalizeTransaction(transaction, wallet) {
  const from = String(transaction.from || "").toLowerCase();
  const to = String(transaction.to || "").toLowerCase();
  const hasSent = transaction.sentAssets.length > 0;
  const hasReceived = transaction.receivedAssets.length > 0;
  const method = cleanMethod(transaction.method);
  const hasInput = transaction.input && transaction.input !== "0x";

  let type = "unknown";
  let summary = "Undecoded transaction";

  if (hasSent && hasReceived) {
    type = "swap";
    summary = `Swapped ${formatAssetList(transaction.sentAssets)} for ${formatAssetList(transaction.receivedAssets)}`;
  } else if (hasSent || hasReceived) {
    type = "transfer";
    summary = hasSent
      ? `Sent ${formatAssetList(transaction.sentAssets)}`
      : `Received ${formatAssetList(transaction.receivedAssets)}`;
  } else if (method || hasInput) {
    type = "contract_interaction";
    summary = method ? `Contract interaction: ${method}` : "Undecoded contract interaction";
  }

  const counterparty =
    from === wallet
      ? transaction.to
      : to === wallet
        ? transaction.from
        : transaction.to || transaction.from;

  return {
    ...transaction,
    fee: from === wallet ? transaction.fee : null,
    type,
    summary,
    counterparty: counterparty || null,
  };
}

function cleanMethod(method) {
  const value = String(method || "").trim();
  if (!value) return null;
  return value.replace(/\(.*/, "");
}

function formatAssetList(assets) {
  return assets.map((asset) => `${asset.amount} ${asset.symbol}`).join(" + ");
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function formatUnits(value, decimals = 18) {
  const raw = String(value ?? "0").trim();
  if (!/^\d+$/.test(raw)) return "0";

  const places = Math.max(0, Number(decimals) || 0);
  const padded = raw.padStart(places + 1, "0");
  const whole = places ? padded.slice(0, -places) : padded;
  const fraction = places ? padded.slice(-places).replace(/0+$/, "") : "";
  return fraction ? `${whole}.${fraction}` : whole;
}

function addDecimalStrings(a, b) {
  const places = Math.max(decimalPlaces(a), decimalPlaces(b));
  const left = toScaledBigInt(a, places);
  const right = toScaledBigInt(b, places);
  return formatUnits(String(left + right), places);
}

function decimalPlaces(value) {
  return String(value).split(".")[1]?.length || 0;
}

function toScaledBigInt(value, places) {
  const [whole, fraction = ""] = String(value).split(".");
  return BigInt(`${whole}${fraction.padEnd(places, "0")}`);
}

function hasPositiveValue(value) {
  return /^\d*\.?\d+$/.test(String(value || "")) && Number(value) > 0;
}
