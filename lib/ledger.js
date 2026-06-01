export const STORAGE_KEY = "btc-investment-tracker:v1";
export const RATE_CACHE_KEY = "btc-investment-tracker:rates:v1";
export const BACKUP_SCHEMA_VERSION = 1;

export const FIAT = ["EUR", "USD", "HUF", "GBP", "CHF", "PLN", "CZK", "RON", "CAD", "AUD", "JPY"];

export const CRYPTO = [
  "BTC",
  "ETH",
  "USDC",
  "USDT",
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
export const STABLES = new Set(["USDC", "USDT", "DAI"]);
export const SAMPLE_ROW_IDS = new Set(["seed-1", "seed-2"]);

export const COINGECKO_IDS = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDC: "usd-coin",
  USDT: "tether",
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
  const cleaned = String(value || "").trim().toUpperCase();
  if (cleaned === "EURO" || cleaned === "EUROS") return "EUR";
  if (cleaned === "DOLLAR" || cleaned === "DOLLARS" || cleaned === "USDOLLAR") return "USD";
  if (cleaned === "FORINT" || cleaned === "FORINTS") return "HUF";
  if (cleaned === "BITCOIN") return "BTC";
  if (cleaned === "ETHER" || cleaned === "ETHEREUM") return "ETH";
  return cleaned.replace(/[^A-Z]/g, "");
}

export function parseTrade(input) {
  const text = input.trim();
  const pattern =
    /(?:i\s+)?(?:bought|buy|purchased|got)\s+([0-9]+(?:[.,][0-9]+)?)\s*([a-zA-Z]+)\s+(?:for|with|using)\s+([0-9]+(?:[.,][0-9]+)?)\s*([a-zA-Z]+)/i;
  const match = text.match(pattern);
  if (!match) return null;
  const buyAmount = Number(match[1].replace(",", "."));
  const sellAmount = Number(match[3].replace(",", "."));
  const buyAsset = normalizeAsset(match[2]);
  const sellAsset = normalizeAsset(match[4]);
  if (!buyAmount || !sellAmount || !ASSETS.includes(buyAsset) || !ASSETS.includes(sellAsset)) return null;
  return { buyAmount, buyAsset, sellAmount, sellAsset };
}

export function parseNumber(value) {
  if (typeof value === "number") return value;
  return Number(String(value ?? "").trim().replace(",", "."));
}

export function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare) return dateCompare;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });
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
  if (!ASSETS.includes(buyAsset)) errors.push(`unsupported buy asset ${buyAsset || "(blank)"}`);
  if (!ASSETS.includes(sellAsset)) errors.push(`unsupported paid asset ${sellAsset || "(blank)"}`);

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
  };
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
  return Number(value || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  });
}

export function csvCell(item) {
  return `"${String(item ?? "").replaceAll('"', '""')}"`;
}
