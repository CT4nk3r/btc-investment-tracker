export const STORAGE_KEY = "btc-investment-tracker:v1";
export const RATE_CACHE_KEY = "btc-investment-tracker:rates:v1";
export const BASE_CURRENCY_KEY = "btc-investment-tracker:base-currency:v1";
export const BACKUP_SCHEMA_VERSION = 1;

export const FIAT = ["EUR", "USD", "HUF", "GBP", "CHF", "PLN", "CZK", "RON", "CAD", "AUD", "JPY"];

export const CRYPTO = [
  "BTC",
  "WBTC",
  "ETH",
  "POL",
  "USDC",
  "USDT",
  "EURC",
  "SOL",
  "BNB",
  "XRP",
  "ADA",
  "DOGE",
  "AVAX",
  "DOT",
  "MATIC",
  "LINK",
  "LTC",
  "BCH",
  "ATOM",
  "ARB",
  "OP",
  "TRX",
  "SHIB",
  "DAI",
];

export const ASSETS = [...FIAT, ...CRYPTO];
export const INTERNAL_ASSETS = ["EXTERNAL_WALLET", "NETWORK_FEE"];
export const LEDGER_ASSETS = [...ASSETS, ...INTERNAL_ASSETS];
export const STABLES = new Set(["USDC", "USDT", "DAI"]);
export const SAMPLE_ROW_IDS = new Set(["seed-1", "seed-2"]);

const ASSET_ALIASES = {
  euro: "EUR",
  euros: "EUR",
  eur: "EUR",
  dollar: "USD",
  dollars: "USD",
  buck: "USD",
  bucks: "USD",
  usd: "USD",
  "us dollar": "USD",
  "us dollars": "USD",
  forint: "HUF",
  forints: "HUF",
  huf: "HUF",
  "hungarian forint": "HUF",
  pound: "GBP",
  pounds: "GBP",
  sterling: "GBP",
  gbp: "GBP",
  franc: "CHF",
  francs: "CHF",
  chf: "CHF",
  zloty: "PLN",
  zlotys: "PLN",
  pln: "PLN",
  koruna: "CZK",
  korunas: "CZK",
  czk: "CZK",
  leu: "RON",
  lei: "RON",
  ron: "RON",
  bitcoin: "BTC",
  bitcoins: "BTC",
  bitcon: "BTC",
  bitcion: "BTC",
  bittcoin: "BTC",
  btc: "BTC",
  ether: "ETH",
  ethereum: "ETH",
  eth: "ETH",
  "usd coin": "USDC",
  usdc: "USDC",
  tether: "USDT",
  usdt: "USDT",
  "euro coin": "EURC",
  eurc: "EURC",
  dai: "DAI",
  solana: "SOL",
  sol: "SOL",
  binance: "BNB",
  "binance coin": "BNB",
  bnb: "BNB",
  ripple: "XRP",
  xrp: "XRP",
  cardano: "ADA",
  ada: "ADA",
  doge: "DOGE",
  dogecoin: "DOGE",
  avalanche: "AVAX",
  avax: "AVAX",
  polkadot: "DOT",
  dot: "DOT",
  polygon: "MATIC",
  matic: "MATIC",
  chainlink: "LINK",
  link: "LINK",
  litecoin: "LTC",
  ltc: "LTC",
  "bitcoin cash": "BCH",
  bch: "BCH",
  cosmos: "ATOM",
  atom: "ATOM",
  arbitrum: "ARB",
  arb: "ARB",
  optimism: "OP",
  op: "OP",
  tron: "TRX",
  trx: "TRX",
  shiba: "SHIB",
  "shiba inu": "SHIB",
  shib: "SHIB",
  externalwallet: "EXTERNAL_WALLET",
  networkfee: "NETWORK_FEE",
};

export const COINGECKO_IDS = {
  BTC: "bitcoin",
  WBTC: "wrapped-bitcoin",
  ETH: "ethereum",
  POL: "polygon-ecosystem-token",
  USDC: "usd-coin",
  USDT: "tether",
  EURC: "euro-coin",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  MATIC: "matic-network",
  LINK: "chainlink",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  ATOM: "cosmos",
  ARB: "arbitrum",
  OP: "optimism",
  TRX: "tron",
  SHIB: "shiba-inu",
  DAI: "dai",
};

export function normalizeAsset(value) {
  const asset = normalizeAssetName(value);
  return asset || String(value || "").trim().toUpperCase().replace(/[^A-Z]/g, "");
}

export function parseTrade(input) {
  const text = cleanTradeText(input);
  if (!text) return null;

  const buyFirst = matchTradePattern(
    text,
    /(?:^|\s)(?:i\s+)?(?:bought|buy|purchased|got|acquired)\s+(\d+(?:[.,]\d+)?)\s+(.+?)\s+(?:for|with|using|paid|costing)\s+(\d+(?:[.,]\d+)?)\s+(.+?)\s*$/i,
  );
  if (buyFirst) return buyFirst;

  const sellFirst = matchTradePattern(
    text,
    /(?:^|\s)(?:i\s+)?(?:spent|paid|used)\s+(\d+(?:[.,]\d+)?)\s+(.+?)\s+(?:on|for|to buy|buying)\s+(\d+(?:[.,]\d+)?)\s+(.+?)\s*$/i,
    true,
  );
  if (sellFirst) return sellFirst;

  return null;
}

function matchTradePattern(text, pattern, sellFirst = false) {
  const match = text.match(pattern);
  if (!match) return null;

  const firstAmount = Number(match[1].replace(",", "."));
  const firstAsset = normalizeAssetName(match[2]);
  const secondAmount = Number(match[3].replace(",", "."));
  const secondAsset = normalizeAssetName(match[4]);

  const buyAmount = sellFirst ? secondAmount : firstAmount;
  const buyAsset = sellFirst ? secondAsset : firstAsset;
  const sellAmount = sellFirst ? firstAmount : secondAmount;
  const sellAsset = sellFirst ? firstAsset : secondAsset;

  if (!buyAmount || !sellAmount || !ASSETS.includes(buyAsset) || !ASSETS.includes(sellAsset)) return null;
  return { buyAmount, buyAsset, sellAmount, sellAsset };
}

function cleanTradeText(input) {
  return String(input || "")
    .trim()
    .replace(/[’']/g, "")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeAssetName(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");

  if (!key) return "";
  if (ASSET_ALIASES[key]) return ASSET_ALIASES[key];

  const ticker = key.toUpperCase().replace(/[^A-Z]/g, "");
  if (ASSETS.includes(ticker)) return ticker;

  const compact = key.replace(/\s/g, "");
  const fuzzy = Object.entries(ASSET_ALIASES).find(([alias]) => {
    const aliasCompact = alias.replace(/\s/g, "");
    if (aliasCompact.length < 5) return false;
    const distance = levenshtein(compact, aliasCompact);
    return distance <= (aliasCompact.length >= 8 ? 2 : 1);
  });

  return fuzzy ? fuzzy[1] : "";
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const costs = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = i - 1;
    costs[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = costs[j];
      costs[j] = Math.min(
        costs[j] + 1,
        costs[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return costs[b.length];
}

export function parseNumber(value) {
  if (typeof value === "number") return value;
  return Number(String(value ?? "").trim().replace(",", "."));
}

export function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const dateCompare = sortableDate(b.date).localeCompare(sortableDate(a.date));
    if (dateCompare) return dateCompare;
    return sortableDate(b.createdAt).localeCompare(sortableDate(a.createdAt));
  });
}

function sortableDate(value) {
  return value instanceof Date ? value.toISOString() : String(value || "");
}

export function withoutSampleRows(rows) {
  return rows.filter((row) => !SAMPLE_ROW_IDS.has(row.id));
}

export function rowTradeKey(row) {
  return [
    row.date,
    Number(row.buyAmount).toFixed(12),
    row.buyAsset,
    Number(row.sellAmount).toFixed(12),
    row.sellAsset,
  ].join("|");
}

export function normalizeImportedRows(inputRows, existingRows = []) {
  const validRows = [];
  const invalidRows = [];
  const seenInFile = new Set();
  const existingIds = new Set(existingRows.map((row) => row.id).filter(Boolean));
  const existingTradeKeys = new Set(existingRows.map(rowTradeKey));
  let duplicateInFileCount = 0;
  let duplicateExistingCount = 0;

  inputRows.forEach((input, index) => {
    const result = normalizeImportedRow(input, index + 1);
    if (!result.row) {
      invalidRows.push(result);
      return;
    }

    const key = rowTradeKey(result.row);
    if (seenInFile.has(key)) {
      duplicateInFileCount += 1;
      return;
    }
    seenInFile.add(key);

    if (existingIds.has(result.row.id) || existingTradeKeys.has(key)) duplicateExistingCount += 1;
    validRows.push(result.row);
  });

  return {
    validRows: sortRows(withoutSampleRows(validRows)),
    invalidRows,
    duplicateInFileCount,
    duplicateExistingCount,
  };
}

export function normalizeImportedRow(input, lineNumber = 1) {
  const buyAmount = parseNumber(input.buyAmount ?? input.buy_amount);
  const sellAmount = parseNumber(input.sellAmount ?? input.sell_amount);
  const buyAsset = normalizeAsset(input.buyAsset ?? input.buy_asset);
  const sellAsset = normalizeAsset(input.sellAsset ?? input.sell_asset);
  const date = String(input.date ?? input.trade_date ?? "").slice(0, 10);
  const errors = [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    errors.push("invalid date");
  }
  if (!Number.isFinite(buyAmount) || buyAmount <= 0) errors.push("invalid buy amount");
  if (!Number.isFinite(sellAmount) || sellAmount <= 0) errors.push("invalid paid amount");
  if (!LEDGER_ASSETS.includes(buyAsset)) errors.push(`unsupported buy asset ${buyAsset || "(blank)"}`);
  if (!LEDGER_ASSETS.includes(sellAsset)) errors.push(`unsupported paid asset ${sellAsset || "(blank)"}`);

  if (errors.length) {
    return {
      lineNumber,
      error: errors.join(", "),
      raw: input,
    };
  }

  const note = String(input.note ?? "").trim();
  const raw = String(input.raw ?? input.description ?? `${buyAmount} ${buyAsset} for ${sellAmount} ${sellAsset}`).trim();
  const createdAt = Date.parse(input.createdAt ?? input.created_at)
    ? new Date(input.createdAt ?? input.created_at).toISOString()
    : new Date().toISOString();
  const sourceMetadata = normalizeSourceMetadata(input.sourceMetadata ?? input.source_metadata);

  return {
    row: {
      id: String(input.id || crypto.randomUUID()),
      date,
      raw,
      buyAmount,
      buyAsset,
      sellAmount,
      sellAsset,
      note,
      createdAt,
      sourceMetadata,
    },
  };
}

export function cleanExportRow(row) {
  return {
    id: row.id,
    date: row.date,
    buyAmount: row.buyAmount,
    buyAsset: row.buyAsset,
    sellAmount: row.sellAmount,
    sellAsset: row.sellAsset,
    note: row.note || "",
    raw: row.raw || "",
    createdAt: row.createdAt,
    sourceMetadata: row.sourceMetadata || {},
  };
}

function normalizeSourceMetadata(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function parseJsonRows(text) {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.rows)) return parsed.rows;
  if (Array.isArray(parsed.trades)) return parsed.trades;
  if (Array.isArray(parsed.transactions)) return parsed.transactions;
  throw new Error("Unsupported JSON backup");
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value !== "")) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  return rows.slice(1).map((values) =>
    headers.reduce((record, header, index) => {
      record[header] = values[index] ?? "";
      return record;
    }, {}),
  );
}

export function buildImportPreview(text, fileName, existingRows) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty file");
  const sourceRows = fileName.toLowerCase().endsWith(".csv") ? parseCsv(trimmed) : parseJsonRows(trimmed);
  const normalized = normalizeImportedRows(sourceRows, existingRows);
  if (!normalized.validRows.length && !normalized.invalidRows.length) throw new Error("No rows found");
  return {
    fileName,
    ...normalized,
  };
}

export function formatAmount(value, asset = "") {
  const digits = Math.abs(value) >= 1000 ? 2 : Math.abs(value) >= 1 ? 4 : 8;
  return `${Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: digits,
  })}${asset ? ` ${asset}` : ""}`;
}

export function formatEuro(value) {
  return formatCurrency(value, "EUR");
}

export function formatCurrency(value, currency = "EUR") {
  return Number(value || 0).toLocaleString(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
}

export function csvCell(item) {
  return `"${String(item ?? "").replaceAll('"', '""')}"`;
}
