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
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
  Upload,
  WalletCards,
  X,
} from "lucide-react";
import {
  ASSETS,
  BACKUP_SCHEMA_VERSION,
  BASE_CURRENCY_KEY,
  COINGECKO_IDS,
  FIAT,
  INTERNAL_ASSETS,
  RATE_CACHE_KEY,
  STABLES,
  STORAGE_KEY,
  buildImportPreview,
  cleanExportRow,
  csvCell,
  formatAmount,
  formatCurrency,
  normalizeImportedRows,
  parseTrade,
  sortRows,
  withoutSampleRows,
} from "@/lib/ledger";
import { readJsonResponse } from "@/lib/http";
import { calculateLots, summarizeLotBasis } from "@/lib/cost-basis";

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
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [rates, setRates] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      return JSON.parse(window.localStorage.getItem(RATE_CACHE_KEY)) || null;
    } catch {
      return null;
    }
  });
  const [rateState, setRateState] = useState("idle");
  const [baseCurrency, setBaseCurrency] = useState(() => {
    if (typeof window === "undefined") return "EUR";
    return window.localStorage.getItem(BASE_CURRENCY_KEY) === "USD" ? "USD" : "EUR";
  });

  const parsed = useMemo(() => parseTrade(phrase), [phrase]);
  const balances = useMemo(() => holdingsFromRows(rows), [rows]);
  const lots = useMemo(() => calculateLots(rows), [rows]);
  const portfolio = useMemo(() => valuePortfolio(balances, rates, baseCurrency), [balances, rates, baseCurrency]);
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

  function changeBaseCurrency(value) {
    const next = value === "USD" ? "USD" : "EUR";
    window.localStorage.setItem(BASE_CURRENCY_KEY, next);
    setBaseCurrency(next);
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

  function startEdit(row) {
    setServerError("");
    setEditingId(row.id);
    setEditDraft({
      date: row.date,
      buyAmount: String(row.buyAmount),
      buyAsset: row.buyAsset,
      sellAmount: String(row.sellAmount),
      sellAsset: row.sellAsset,
      note: row.note || "",
      raw: row.raw || "",
      createdAt: row.createdAt,
    });
  }

  function updateEditDraft(key, value) {
    setEditDraft((current) => ({ ...(current || {}), [key]: value }));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function saveEdit(id) {
    if (!editDraft) return;

    const buyAmount = parseDraftAmount(editDraft.buyAmount);
    const sellAmount = parseDraftAmount(editDraft.sellAmount);
    if (!Number.isFinite(buyAmount) || buyAmount <= 0 || !Number.isFinite(sellAmount) || sellAmount <= 0) {
      setServerError("Edit needs positive bought and paid amounts.");
      return;
    }

    setIsSaving(true);
    setServerError("");
    try {
      const response = await fetch(`/api/ledger/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editDraft,
          buyAmount,
          sellAmount,
          raw:
            editDraft.raw ||
            `${buyAmount} ${editDraft.buyAsset} for ${sellAmount} ${editDraft.sellAsset}`,
        }),
      });
      const data = (await readJsonResponse(response)) || {};
      if (!response.ok) throw new Error(data.error || "Could not update row");
      setRows((current) => sortRows(current.map((row) => (row.id === id ? data.row : row))));
      cancelEdit();
    } catch (error) {
      setServerError(error.message || "Could not update row");
    } finally {
      setIsSaving(false);
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
          <label className="base-currency">
            Display
            <select value={baseCurrency} onChange={(event) => changeBaseCurrency(event.target.value)}>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </label>
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
        <Stat icon={<WalletCards />} label={`Portfolio est. (${baseCurrency})`} value={portfolio ? formatCurrency(portfolio.value, baseCurrency) : "Waiting for rates"} />
        <Stat icon={<ArrowDownUp />} label="EUR -> stable drag" value={formatBaseFromEur(fxLoss.dragEur, rates, baseCurrency)} tone={fxLoss.dragEur < 0 ? "bad" : "good"} />
        <Stat icon={<Landmark />} label="Tracked records" value={rows.length.toLocaleString()} />
      </section>

      <section className="content-grid">
        <div className="panel">
          <div className="panel-head">
            <h2>Holdings</h2>
            <span>{rateState === "failed" ? "Live rates unavailable" : "Live value where supported"}</span>
          </div>
          <Holdings balances={balances} rates={rates} lots={lots.pools} baseCurrency={baseCurrency} isLoading={isLoadingRows} />
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Tax Helpers</h2>
            <span>FIFO cost tracking</span>
          </div>
          <TaxSummary rows={rows} lots={lots} fxLoss={fxLoss} rates={rates} baseCurrency={baseCurrency} />
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
        <Ledger
          rows={rows}
          removeTrade={removeTrade}
          rates={rates}
          isLoading={isLoadingRows}
          editingId={editingId}
          editDraft={editDraft}
          isSaving={isSaving}
          startEdit={startEdit}
          updateEditDraft={updateEditDraft}
          saveEdit={saveEdit}
          cancelEdit={cancelEdit}
        />
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

function parseDraftAmount(value) {
  return Number(String(value || "").replace(",", "."));
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

function Holdings({ balances, rates, lots, baseCurrency, isLoading }) {
  const visible = Object.entries(balances)
    .filter(([asset, amount]) => !INTERNAL_ASSETS.includes(asset) && Math.abs(amount) > 0.00000001)
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
            const basis = summarizeLotBasis(lots[asset]);
            const live = valueAsset(asset, amount, rates, baseCurrency);
            return (
              <tr key={asset}>
                <td>{asset}</td>
                <td>{formatAmount(amount)}</td>
                <td>{formatCostBasis({ asset, amount, cost, basis, rates, baseCurrency })}</td>
                <td>{live ? formatCurrency(live, baseCurrency) : "No rate"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TaxSummary({ rows, lots, fxLoss, rates, baseCurrency }) {
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
        <strong>{formatBaseFromEur(eurSpent, rates, baseCurrency)}</strong>
      </div>
      <div>
        <span>Open FIFO basis</span>
        <strong>{formatBaseFromEur(btcCost, rates, baseCurrency)}</strong>
      </div>
      <div>
        <span>BTC buy count</span>
        <strong>{btcBuys.length}</strong>
      </div>
      <div>
        <span>Stablecoin FX drag</span>
        <strong className={fxLoss.dragEur < 0 ? "bad-text" : "good-text"}>{formatBaseFromEur(fxLoss.dragEur, rates, baseCurrency)}</strong>
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

function Ledger({
  rows,
  removeTrade,
  rates,
  isLoading,
  editingId,
  editDraft,
  isSaving,
  startEdit,
  updateEditDraft,
  saveEdit,
  cancelEdit,
}) {
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
          {rows.map((row) =>
            editingId === row.id && editDraft ? (
              <tr key={row.id} className="edit-row">
                <td>
                  <input
                    type="date"
                    value={editDraft.date}
                    onChange={(event) => updateEditDraft("date", event.target.value)}
                  />
                </td>
                <td>
                  <div className="asset-edit">
                    <input
                      value={editDraft.buyAmount}
                      onChange={(event) => updateEditDraft("buyAmount", event.target.value)}
                      inputMode="decimal"
                    />
                    <select value={editDraft.buyAsset} onChange={(event) => updateEditDraft("buyAsset", event.target.value)}>
                      {ASSETS.map((asset) => (
                        <option key={asset}>{asset}</option>
                      ))}
                    </select>
                  </div>
                </td>
                <td>
                  <div className="asset-edit">
                    <input
                      value={editDraft.sellAmount}
                      onChange={(event) => updateEditDraft("sellAmount", event.target.value)}
                      inputMode="decimal"
                    />
                    <select value={editDraft.sellAsset} onChange={(event) => updateEditDraft("sellAsset", event.target.value)}>
                      {ASSETS.map((asset) => (
                        <option key={asset}>{asset}</option>
                      ))}
                    </select>
                  </div>
                </td>
                <td>
                  {parseDraftAmount(editDraft.buyAmount) > 0 && parseDraftAmount(editDraft.sellAmount) > 0
                    ? `${formatAmount(parseDraftAmount(editDraft.sellAmount) / parseDraftAmount(editDraft.buyAmount), editDraft.sellAsset)} / ${editDraft.buyAsset}`
                    : "Invalid"}
                </td>
                <td>{formatFxCheck({ ...row, ...editDraft, buyAmount: parseDraftAmount(editDraft.buyAmount), sellAmount: parseDraftAmount(editDraft.sellAmount) }, rates)}</td>
                <td>
                  <input value={editDraft.note} onChange={(event) => updateEditDraft("note", event.target.value)} placeholder="Note" />
                </td>
                <td>
                  <div className="row-actions">
                    <button className="icon-btn" onClick={() => saveEdit(row.id)} disabled={isSaving} aria-label="Save row">
                      <Save size={16} />
                    </button>
                    <button className="icon-btn" onClick={cancelEdit} disabled={isSaving} aria-label="Cancel edit">
                      <X size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
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
                  <div className="row-actions">
                    <button className="icon-btn" onClick={() => startEdit(row)} aria-label="Edit row">
                      <Pencil size={16} />
                    </button>
                    <button className="icon-btn" onClick={() => removeTrade(row.id)} aria-label="Delete row">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ),
          )}
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

function valuePortfolio(balances, rates, baseCurrency) {
  if (!rates) return null;
  return {
    value: Object.entries(balances)
      .filter(([asset]) => !INTERNAL_ASSETS.includes(asset))
      .reduce((sum, [asset, amount]) => sum + (valueAsset(asset, amount, rates, baseCurrency) || 0), 0),
  };
}

function formatCostBasis({ asset, amount, cost, basis, rates, baseCurrency }) {
  if (cost) return formatBaseFromEur(cost, rates, baseCurrency);
  if (asset === "EUR") return formatBaseFromEur(amount, rates, baseCurrency);

  const known = Object.entries(basis).filter(
    ([basisAsset, basisAmount]) => !INTERNAL_ASSETS.includes(basisAsset) && basisAmount > 0,
  );
  if (!known.length) return "Unknown";
  return known.map(([basisAsset, basisAmount]) => formatAmount(basisAmount, basisAsset)).join(" + ");
}

function valueAsset(asset, amount, rates, baseCurrency = "EUR") {
  if (!rates) return null;
  if (asset === baseCurrency) return amount;
  if (asset === "EUR") return convertEur(amount, rates, baseCurrency);
  if (FIAT.includes(asset)) {
    const perEur = rates.fx?.[asset];
    return perEur ? convertEur(amount / perEur, rates, baseCurrency) : null;
  }
  const id = COINGECKO_IDS[asset];
  const price = rates.crypto?.[id]?.[baseCurrency.toLowerCase()];
  return id && price ? amount * price : null;
}

function formatBaseFromEur(value, rates, baseCurrency) {
  const converted = convertEur(value, rates, baseCurrency);
  return converted === null ? "No rate" : formatCurrency(converted, baseCurrency);
}

function convertEur(value, rates, baseCurrency) {
  if (baseCurrency === "EUR") return value;
  return rates?.fx?.USD ? value * rates.fx.USD : null;
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
  return `${implied.toFixed(4)} USD/EUR, ${formatCurrency(drag, "EUR")}`;
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
