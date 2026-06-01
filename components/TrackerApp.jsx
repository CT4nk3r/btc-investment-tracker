"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  Bitcoin,
  CalendarDays,
  CheckCircle2,
  FileJson,
  FileSpreadsheet,
  Landmark,
  Plus,
  RefreshCcw,
  Trash2,
  Upload,
  WalletCards,
} from "lucide-react";
import {
  ASSETS,
  BACKUP_SCHEMA_VERSION,
  COINGECKO_IDS,
  FIAT,
  RATE_CACHE_KEY,
  STABLES,
  STORAGE_KEY,
  buildImportPreview,
  cleanExportRow,
  csvCell,
  formatAmount,
  formatEuro,
  normalizeImportedRows,
  parseTrade,
  sortRows,
  withoutSampleRows,
} from "@/lib/ledger";
import { readJsonResponse } from "@/lib/http";

export default function TrackerApp() {
  const [rows, setRows] = useState([]);
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [serverError, setServerError] = useState("");
  const [phrase, setPhrase] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [manual, setManual] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importError, setImportError] = useState("");
  const [legacyRows, setLegacyRows] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [rates, setRates] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      return JSON.parse(window.localStorage.getItem(RATE_CACHE_KEY)) || null;
    } catch {
      return null;
    }
  });
  const [rateState, setRateState] = useState("idle");

  const parsed = useMemo(() => parseTrade(phrase), [phrase]);
  const balances = useMemo(() => holdingsFromRows(rows), [rows]);
  const lots = useMemo(() => calculateLots(rows), [rows]);
  const portfolio = useMemo(() => valuePortfolio(balances, rates), [balances, rates]);
  const fxLoss = useMemo(() => calculateFxDrag(rows, rates), [rows, rates]);

  useEffect(() => {
    refreshLedger();
    setLegacyRows(readLegacyRows());
    refreshRates();
  }, []);

  async function refreshLedger() {
    setIsLoadingRows(true);
    setServerError("");
    try {
      const response = await fetch("/api/ledger", { cache: "no-store" });
      const data = (await readJsonResponse(response)) || {};
      if (!response.ok) throw new Error(data.error || "Could not load ledger");
      setRows(sortRows(data.rows || []));
    } catch (error) {
      setServerError(error.message || "Could not load ledger");
    } finally {
      setIsLoadingRows(false);
    }
  }

  async function refreshRates() {
    setRateState("loading");
    try {
      const cryptoIds = Object.values(COINGECKO_IDS).join(",");
      const cryptoRes = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoIds}&vs_currencies=eur,usd`,
      );
      const fxRes = await fetch("https://open.er-api.com/v6/latest/EUR");
      if (!cryptoRes.ok || !fxRes.ok) throw new Error("Rate request failed");
      const cryptoJson = await cryptoRes.json();
      const fxJson = await fxRes.json();
      const next = {
        updatedAt: new Date().toISOString(),
        crypto: cryptoJson,
        fx: fxJson.rates || {},
      };
      window.localStorage.setItem(RATE_CACHE_KEY, JSON.stringify(next));
      setRates(next);
      setRateState("ready");
    } catch {
      setRateState("failed");
    }
  }

  async function addTrade() {
    const trade = manual || parsed;
    if (!trade) return;
    setIsSaving(true);
    setServerError("");

    const input = {
      id: crypto.randomUUID(),
      date,
      raw: phrase || `${trade.buyAmount} ${trade.buyAsset} for ${trade.sellAmount} ${trade.sellAsset}`,
      ...trade,
      note,
      createdAt: new Date().toISOString(),
    };

    try {
      const response = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await readJsonResponse(response)) || {};
      if (!response.ok) throw new Error(data.error || "Could not save trade");
      setRows((current) => sortRows([data.row, ...current]));
      setPhrase("");
      setNote("");
      setManual(null);
    } catch (error) {
      setServerError(error.message || "Could not save trade");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeTrade(id) {
    setServerError("");
    const previous = rows;
    setRows((current) => current.filter((row) => row.id !== id));

    try {
      const response = await fetch(`/api/ledger/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = (await readJsonResponse(response)) || {};
      if (!response.ok) throw new Error(data.error || "Could not delete row");
    } catch (error) {
      setRows(previous);
      setServerError(error.message || "Could not delete row");
    }
  }

  function exportJson() {
    const backup = {
      app: "btc-investment-tracker",
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      rowCount: rows.length,
      ratesUpdatedAt: rates?.updatedAt || null,
      rows: rows.map(cleanExportRow),
    };
    download(`btc-investment-tracker-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), "application/json");
  }

  function exportCsv() {
    const header = [
      "id",
      "date",
      "buy_amount",
      "buy_asset",
      "sell_amount",
      "sell_asset",
      "unit_price",
      "note",
      "raw",
      "created_at",
    ];
    const body = rows.map((row) =>
      [
        row.id,
        row.date,
        row.buyAmount,
        row.buyAsset,
        row.sellAmount,
        row.sellAsset,
        row.sellAmount / row.buyAmount,
        row.note,
        row.raw,
        row.createdAt,
      ]
        .map(csvCell)
        .join(","),
    );
    download(`btc-investment-tracker-${new Date().toISOString().slice(0, 10)}.csv`, [header.join(","), ...body].join("\n"), "text/csv;charset=utf-8");
  }

  function importFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const preview = buildImportPreview(String(reader.result), file.name, rows);
        setImportPreview(preview);
        setImportError("");
      } catch {
        setImportPreview(null);
        setImportError("That file could not be imported. Use a JSON backup or CSV exported from this app.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  async function importRows(mode, importRowsToSave = importPreview?.validRows || []) {
    if (!importRowsToSave.length) return;
    setIsSaving(true);
    setServerError("");
    try {
      const response = await fetch("/api/ledger/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, rows: importRowsToSave }),
      });
      const data = (await readJsonResponse(response)) || {};
      if (!response.ok) throw new Error(data.error || "Could not import rows");
      setRows(sortRows(data.rows || []));
      setImportPreview(null);
      setImportError("");
    } catch (error) {
      setServerError(error.message || "Could not import rows");
    } finally {
      setIsSaving(false);
    }
  }

  async function importLegacyRows() {
    await importRows("merge", legacyRows);
    window.localStorage.removeItem(STORAGE_KEY);
    setLegacyRows([]);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Cloud crypto tax ledger</p>
          <h1>BTC Investment Tracker</h1>
        </div>
        <div className="rate-pill">
          <RefreshCcw size={16} />
          <span>{rates ? `Rates ${new Date(rates.updatedAt).toLocaleString()}` : "No live rates yet"}</span>
          <button onClick={refreshRates} aria-label="Refresh exchange rates">
            Refresh
          </button>
        </div>
      </header>

      {serverError ? (
        <div className="import-alert">
          <AlertTriangle size={17} />
          <span>{serverError}</span>
        </div>
      ) : null}

      {legacyRows.length ? (
        <div className="migration-box">
          <div>
            <strong>Local rows found on this browser</strong>
            <span>{legacyRows.length} local records can be merged into your account.</span>
          </div>
          <button onClick={importLegacyRows} disabled={isSaving}>
            Import local rows
          </button>
        </div>
      ) : null}

      <section className="entry-band">
        <div className="entry-main">
          <label htmlFor="phrase">Transaction</label>
          <div className="phrase-row">
            <input
              id="phrase"
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
              placeholder='I spent 10 bucks on 0.001 bittcoin'
            />
            <button className="primary" onClick={addTrade} disabled={isSaving || (!parsed && !manual)}>
              <Plus size={18} />
              {isSaving ? "Saving" : "Add"}
            </button>
          </div>
          <div className="entry-meta">
            <label>
              <CalendarDays size={16} />
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" />
          </div>
          <TradePreview parsed={parsed} />
        </div>
        <ManualTrade manual={manual} setManual={setManual} />
      </section>

      <section className="stats-grid">
        <Stat icon={<Bitcoin />} label="BTC held" value={formatAmount(balances.BTC, "BTC")} />
        <Stat icon={<WalletCards />} label="Portfolio est." value={portfolio ? formatEuro(portfolio.eur) : "Waiting for rates"} />
        <Stat icon={<ArrowDownUp />} label="EUR -> stable drag" value={formatEuro(fxLoss.dragEur)} tone={fxLoss.dragEur < 0 ? "bad" : "good"} />
        <Stat icon={<Landmark />} label="Tracked records" value={rows.length.toLocaleString()} />
      </section>

      <section className="content-grid">
        <div className="panel">
          <div className="panel-head">
            <h2>Holdings</h2>
            <span>{rateState === "failed" ? "Live rates unavailable" : "Live value where supported"}</span>
          </div>
          <Holdings balances={balances} rates={rates} lots={lots.pools} isLoading={isLoadingRows} />
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Tax Helpers</h2>
            <span>FIFO cost tracking</span>
          </div>
          <TaxSummary rows={rows} lots={lots} fxLoss={fxLoss} rates={rates} />
        </div>
      </section>

      <section className="panel ledger-panel">
        <div className="panel-head ledger-actions">
          <div>
            <h2>Ledger</h2>
            <span>Export this before tax filing or browser cleanup</span>
          </div>
          <div className="actions">
            <button onClick={exportCsv}>
              <FileSpreadsheet size={16} />
              CSV
            </button>
            <button onClick={exportJson}>
              <FileJson size={16} />
              JSON
            </button>
            <label className="upload">
              <Upload size={16} />
              Import
              <input type="file" accept="application/json,text/csv,.json,.csv" onChange={importFile} />
            </label>
          </div>
        </div>
        {importError ? (
          <div className="import-alert">
            <AlertTriangle size={17} />
            <span>{importError}</span>
          </div>
        ) : null}
        {importPreview ? (
          <ImportReview
            preview={importPreview}
            isSaving={isSaving}
            onMerge={() => importRows("merge")}
            onReplace={() => importRows("replace")}
            onCancel={() => setImportPreview(null)}
          />
        ) : null}
        <Ledger rows={rows} removeTrade={removeTrade} rates={rates} isLoading={isLoadingRows} />
      </section>
    </main>
  );
}

function readLegacyRows() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return normalizeImportedRows(withoutSampleRows(parsed)).validRows;
  } catch {
    return [];
  }
}

function TradePreview({ parsed }) {
  if (!parsed) {
    return <p className="hint">Try "I bought 0.002 btc for 80 usdc" or "I spent 10 bucks on 0.001 bittcoin".</p>;
  }
  return (
    <p className="parsed">
      Buying <strong>{formatAmount(parsed.buyAmount, parsed.buyAsset)}</strong> with{" "}
      <strong>{formatAmount(parsed.sellAmount, parsed.sellAsset)}</strong>. Effective price:{" "}
      <strong>{formatAmount(parsed.sellAmount / parsed.buyAmount, parsed.sellAsset)} per {parsed.buyAsset}</strong>
    </p>
  );
}

function ManualTrade({ manual, setManual }) {
  const [draft, setDraft] = useState({
    buyAmount: "",
    buyAsset: "BTC",
    sellAmount: "",
    sellAsset: "USDC",
  });

  function update(key, value) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    const buyAmount = Number(next.buyAmount);
    const sellAmount = Number(next.sellAmount);
    if (buyAmount > 0 && sellAmount > 0) {
      setManual({
        buyAmount,
        buyAsset: next.buyAsset,
        sellAmount,
        sellAsset: next.sellAsset,
      });
    } else {
      setManual(null);
    }
  }

  return (
    <div className={`manual-box ${manual ? "active" : ""}`}>
      <h2>Manual Entry</h2>
      <div className="manual-grid">
        <input value={draft.buyAmount} onChange={(event) => update("buyAmount", event.target.value)} placeholder="Bought" />
        <select value={draft.buyAsset} onChange={(event) => update("buyAsset", event.target.value)}>
          {ASSETS.map((asset) => (
            <option key={asset}>{asset}</option>
          ))}
        </select>
        <input value={draft.sellAmount} onChange={(event) => update("sellAmount", event.target.value)} placeholder="Paid" />
        <select value={draft.sellAsset} onChange={(event) => update("sellAsset", event.target.value)}>
          {ASSETS.map((asset) => (
            <option key={asset}>{asset}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, tone }) {
  return (
    <div className={`stat ${tone || ""}`}>
      {React.cloneElement(icon, { size: 22 })}
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function Holdings({ balances, rates, lots, isLoading }) {
  const visible = Object.entries(balances)
    .filter(([, amount]) => Math.abs(amount) > 0.00000001)
    .sort(([a], [b]) => (a === "BTC" ? -1 : b === "BTC" ? 1 : a.localeCompare(b)));

  if (isLoading) return <p className="empty">Loading holdings...</p>;
  if (!visible.length) return <p className="empty">No holdings yet.</p>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Asset</th>
            <th>Amount</th>
            <th>Cost basis</th>
            <th>Live value</th>
          </tr>
        </thead>
        <tbody>
          {visible.map(([asset, amount]) => {
            const cost = (lots[asset] || []).reduce((sum, lot) => sum + (lot.costEur || 0), 0);
            const live = valueAsset(asset, amount, rates);
            return (
              <tr key={asset}>
                <td>{asset}</td>
                <td>{formatAmount(amount)}</td>
                <td>{cost ? formatEuro(cost) : asset === "EUR" ? formatEuro(amount) : "Unknown"}</td>
                <td>{live ? formatEuro(live) : "No rate"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TaxSummary({ rows, lots, fxLoss, rates }) {
  const btcBuys = rows.filter((row) => row.buyAsset === "BTC");
  const eurSpent = rows.filter((row) => row.sellAsset === "EUR").reduce((sum, row) => sum + row.sellAmount, 0);
  const btcCost = (lots.pools.BTC || [])
    .filter((lot) => lot.amount > 0)
    .reduce((sum, lot) => sum + (lot.costEur || 0), 0);
  const usdPerEur = getUsdPerEur(rates);

  return (
    <div className="tax-grid">
      <div>
        <span>EUR spent into crypto</span>
        <strong>{formatEuro(eurSpent)}</strong>
      </div>
      <div>
        <span>Open FIFO basis</span>
        <strong>{formatEuro(btcCost)}</strong>
      </div>
      <div>
        <span>BTC buy count</span>
        <strong>{btcBuys.length}</strong>
      </div>
      <div>
        <span>Stablecoin FX drag</span>
        <strong className={fxLoss.dragEur < 0 ? "bad-text" : "good-text"}>{formatEuro(fxLoss.dragEur)}</strong>
      </div>
      <div>
        <span>Current USD per EUR</span>
        <strong>{usdPerEur ? usdPerEur.toFixed(4) : "No rate"}</strong>
      </div>
      <p className="tax-note">
        The app estimates FIFO basis from your recorded chain of trades. FX drag compares your EUR-to-stablecoin buys
        against the current EUR/USD rate when live rates are available. Keep exchange statements too; tax rules differ by
        country and this is a filing helper, not tax advice.
      </p>
    </div>
  );
}

function Ledger({ rows, removeTrade, rates, isLoading }) {
  if (isLoading) return <p className="empty">Loading ledger...</p>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Bought</th>
            <th>Paid</th>
            <th>Price</th>
            <th>FX check</th>
            <th>Note</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.date}</td>
              <td>{formatAmount(row.buyAmount, row.buyAsset)}</td>
              <td>{formatAmount(row.sellAmount, row.sellAsset)}</td>
              <td>
                {formatAmount(row.sellAmount / row.buyAmount, row.sellAsset)} / {row.buyAsset}
              </td>
              <td>{formatFxCheck(row, rates)}</td>
              <td>{row.note || row.raw}</td>
              <td>
                <button className="icon-btn" onClick={() => removeTrade(row.id)} aria-label="Delete row">
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImportReview({ preview, isSaving, onMerge, onReplace, onCancel }) {
  const canImport = preview.validRows.length > 0 && !isSaving;

  return (
    <div className="import-review">
      <div className="import-review-head">
        <div>
          <h3>{preview.fileName}</h3>
          <p>
            {preview.validRows.length} valid rows
            {preview.duplicateInFileCount ? `, ${preview.duplicateInFileCount} duplicate rows skipped inside file` : ""}
            {preview.duplicateExistingCount ? `, ${preview.duplicateExistingCount} already in ledger` : ""}
          </p>
        </div>
        <CheckCircle2 size={20} />
      </div>
      {preview.invalidRows.length ? (
        <div className="import-issues">
          <strong>{preview.invalidRows.length} rows need attention</strong>
          {preview.invalidRows.slice(0, 4).map((issue) => (
            <span key={`${issue.lineNumber}-${issue.error}`}>
              Row {issue.lineNumber}: {issue.error}
            </span>
          ))}
        </div>
      ) : null}
      <div className="import-buttons">
        <button onClick={onMerge} disabled={!canImport}>
          Merge new rows
        </button>
        <button onClick={onReplace} disabled={!canImport}>
          Replace ledger
        </button>
        <button onClick={onCancel} disabled={isSaving}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function holdingsFromRows(rows) {
  const balances = {};
  for (const asset of ASSETS) balances[asset] = 0;
  for (const row of rows) {
    balances[row.buyAsset] = (balances[row.buyAsset] || 0) + row.buyAmount;
    balances[row.sellAsset] = (balances[row.sellAsset] || 0) - row.sellAmount;
  }
  return balances;
}

function calculateLots(rows) {
  const pools = {};
  const realized = [];

  for (const row of [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))) {
    const fromCost = takeCost(pools, row.sellAsset, row.sellAmount);
    const inferredEurCost =
      fromCost.costEur > 0 ? fromCost.costEur : row.sellAsset === "EUR" ? row.sellAmount : undefined;

    if (!pools[row.buyAsset]) pools[row.buyAsset] = [];
    pools[row.buyAsset].push({
      amount: row.buyAmount,
      costEur: inferredEurCost,
      sourceId: row.id,
      date: row.date,
    });

    if (fromCost.costEur > 0 && row.sellAsset !== "EUR") {
      realized.push({
        row,
        asset: row.sellAsset,
        disposedAmount: row.sellAmount,
        costEur: fromCost.costEur,
        proceedsEur: inferredEurCost,
      });
    }
  }

  return { pools, realized };
}

function takeCost(pools, asset, amount) {
  if (asset === "EUR") return { costEur: amount };
  if (!pools[asset]) return { costEur: 0 };
  let remaining = amount;
  let costEur = 0;
  for (const lot of pools[asset]) {
    if (remaining <= 0) break;
    const used = Math.min(lot.amount, remaining);
    const ratio = lot.amount ? used / lot.amount : 0;
    costEur += (lot.costEur || 0) * ratio;
    lot.amount -= used;
    lot.costEur = (lot.costEur || 0) * (1 - ratio);
    remaining -= used;
  }
  pools[asset] = pools[asset].filter((lot) => lot.amount > 0.000000000001);
  return { costEur };
}

function valuePortfolio(balances, rates) {
  if (!rates) return null;
  return {
    eur: Object.entries(balances).reduce((sum, [asset, amount]) => sum + (valueAsset(asset, amount, rates) || 0), 0),
  };
}

function valueAsset(asset, amount, rates) {
  if (!rates) return null;
  if (asset === "EUR") return amount;
  if (FIAT.includes(asset)) {
    const perEur = rates.fx?.[asset];
    return perEur ? amount / perEur : null;
  }
  const id = COINGECKO_IDS[asset];
  return id && rates.crypto?.[id]?.eur ? amount * rates.crypto[id].eur : null;
}

function calculateFxDrag(rows, rates) {
  const usdPerEur = getUsdPerEur(rates) || 1.08;
  let dragEur = 0;
  let grossEur = 0;
  for (const row of rows) {
    if (STABLES.has(row.buyAsset) && row.sellAsset === "EUR") {
      const idealEur = row.buyAmount / usdPerEur;
      grossEur += row.sellAmount;
      dragEur += idealEur - row.sellAmount;
    }
  }
  return { dragEur, grossEur };
}

function getUsdPerEur(rates) {
  return rates?.fx?.USD || null;
}

function formatFxCheck(row, rates) {
  if (!STABLES.has(row.buyAsset) || row.sellAsset !== "EUR") return "-";
  const implied = row.buyAmount / row.sellAmount;
  const live = getUsdPerEur(rates);
  if (!live) return `${implied.toFixed(4)} USD/EUR`;
  const idealEur = row.buyAmount / live;
  const drag = idealEur - row.sellAmount;
  return `${implied.toFixed(4)} USD/EUR, ${formatEuro(drag)}`;
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
