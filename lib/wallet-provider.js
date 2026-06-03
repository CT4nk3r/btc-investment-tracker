import { normalizeWalletTransactions, WALLET_CHAINS } from "./wallet-transactions.js";

const PAGE_SIZE = 50;
const MAX_PAGES = 5;
const REQUEST_TIMEOUT_MS = 8_000;

export async function fetchWalletTransactions({
  address,
  chainId,
  startDate,
  endDate,
  fetchImpl = fetch,
}) {
  const chain = WALLET_CHAINS[chainId];
  if (!chain) throw providerError("Unsupported chain.", 400);

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);

  const [normalResult, tokenResult] = await Promise.all([
    fetchPages({
      url: `${chain.blockscoutApiUrl}/addresses/${address}/transactions`,
      start,
      end,
      fetchImpl,
      mapItem: mapBlockscoutTransaction,
    }),
    fetchPages({
      url: `${chain.blockscoutApiUrl}/addresses/${address}/token-transfers`,
      start,
      end,
      fetchImpl,
      mapItem: mapBlockscoutTokenTransfer,
      initialParams: { type: "ERC-20" },
    }),
  ]);

  return {
    transactions: normalizeWalletTransactions({
      address,
      chain,
      normalTransactions: normalResult.items,
      tokenTransfers: tokenResult.items,
    }),
    meta: {
      provider: "Blockscout",
      chain: { id: chain.id, name: chain.name, nativeSymbol: chain.nativeSymbol },
      truncated: normalResult.truncated || tokenResult.truncated,
      resultLimit: PAGE_SIZE * MAX_PAGES,
    },
  };
}

async function fetchPages({ url, start, end, fetchImpl, mapItem, initialParams = {} }) {
  const items = [];
  let params = initialParams;
  let page = 0;
  let hasMore = false;

  while (page < MAX_PAGES) {
    const response = await fetchJson(url, params, fetchImpl);
    const pageItems = Array.isArray(response.items) ? response.items : [];
    let reachedBeforeStart = false;

    for (const item of pageItems) {
      const timestamp = new Date(item.timestamp);
      if (Number.isNaN(timestamp.getTime())) continue;
      if (timestamp < start) {
        reachedBeforeStart = true;
        continue;
      }
      if (timestamp <= end) items.push(mapItem(item));
    }

    const next = response.next_page_params;
    hasMore = Boolean(next);
    page += 1;
    if (!next || reachedBeforeStart) {
      hasMore = false;
      break;
    }
    params = { ...initialParams, ...next };
  }

  return { items, truncated: hasMore };
}

async function fetchJson(url, params, fetchImpl) {
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) target.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(target, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (response.status === 429) {
      throw providerError("Explorer rate limit reached. Please try again in a moment.", 429);
    }
    if (!response.ok) {
      throw providerError("Explorer request failed. Please try again later.", 502);
    }
    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw providerError("Explorer request timed out. Try a shorter date range.", 504);
    }
    if (error.status) throw error;
    throw providerError("Could not reach the explorer provider.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function mapBlockscoutTransaction(transaction) {
  return {
    hash: transaction.hash,
    timestamp: transaction.timestamp,
    blockNumber: transaction.block_number,
    status: transaction.status,
    from: transaction.from?.hash,
    to: transaction.to?.hash,
    value: transaction.value,
    feeWei: transaction.fee?.value,
    input: transaction.raw_input,
    method: transaction.method,
  };
}

function mapBlockscoutTokenTransfer(transfer) {
  return {
    hash: transfer.transaction_hash,
    timestamp: transfer.timestamp,
    blockNumber: transfer.block_number,
    from: transfer.from?.hash,
    to: transfer.to?.hash,
    value: transfer.total?.value,
    decimals: transfer.total?.decimals ?? transfer.token?.decimals,
    symbol: transfer.token?.symbol,
    contractAddress: transfer.token?.address_hash,
    method: transfer.method,
  };
}

function providerError(message, status) {
  return Object.assign(new Error(message), { status });
}
