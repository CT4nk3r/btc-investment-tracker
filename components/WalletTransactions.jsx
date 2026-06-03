"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Search,
  WalletCards,
} from "lucide-react";
import { readJsonResponse } from "@/lib/http";
import { isEvmAddress, WALLET_CHAINS } from "@/lib/wallet-transactions";

const today = new Date().toISOString().slice(0, 10);
const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

export default function WalletTransactions() {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState("ethereum");
  const [startDate, setStartDate] = useState(monthAgo);
  const [endDate, setEndDate] = useState(today);
  const [transactions, setTransactions] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  async function searchTransactions(event) {
    event.preventDefault();
    const validationError = validateSearch({ address, startDate, endDate });
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError("");
    setHasSearched(true);
    try {
      const params = new URLSearchParams({ address: address.trim(), chain, startDate, endDate });
      const response = await fetch(`/api/wallet-transactions?${params}`, { cache: "no-store" });
      const data = (await readJsonResponse(response)) || {};
      if (!response.ok) throw new Error(data.error || "Could not load wallet activity");
      setTransactions(data.transactions || []);
      setMeta(data.meta || null);
    } catch (searchError) {
      setTransactions([]);
      setMeta(null);
      setError(searchError.message || "Could not load wallet activity");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="shell wallet-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">On-chain explorer</p>
          <h1>Wallet Activity</h1>
        </div>
        <Link className="button-link" href="/dashboard">
          <ArrowLeft size={16} />
          Back to ledger
        </Link>
      </header>

      <section className="entry-band wallet-search-band">
        <div className="entry-main">
          <label htmlFor="wallet-address">Wallet address</label>
          <form onSubmit={searchTransactions}>
            <div className="wallet-search-grid">
              <input
                id="wallet-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="0x..."
                spellCheck="false"
                autoComplete="off"
              />
              <select value={chain} onChange={(event) => setChain(event.target.value)} aria-label="Chain">
                {Object.values(WALLET_CHAINS).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <label>
                Start date
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </label>
              <label>
                End date
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </label>
              <button className="primary" type="submit" disabled={isLoading}>
                <Search size={18} />
                {isLoading ? "Loading" : "Search"}
              </button>
            </div>
          </form>
          <p className="hint">
            Search Ethereum-compatible wallets across a date range. Results combine native transfers,
            ERC-20 activity, fees, and detectable swaps.
          </p>
        </div>
      </section>

      {error ? (
        <div className="import-alert">
          <AlertTriangle size={17} />
          <span>{error}</span>
        </div>
      ) : null}

      {meta?.truncated ? (
        <div className="migration-box">
          <div>
            <strong>Result limit reached</strong>
            <span>Showing up to {meta.resultLimit} records from each activity source. Try a shorter date range.</span>
          </div>
        </div>
      ) : null}

      <section className="panel wallet-results">
        <div className="panel-head">
          <div>
            <h2>Transactions</h2>
            <span>
              {meta
                ? `${transactions.length.toLocaleString()} results on ${meta.chain.name}, provided by ${meta.provider}`
                : "Explorer-style wallet history"}
            </span>
          </div>
          <WalletCards size={22} />
        </div>

        {isLoading ? <p className="empty">Loading on-chain activity...</p> : null}
        {!isLoading && hasSearched && !transactions.length && !error ? (
          <p className="empty">No transactions found in this date range.</p>
        ) : null}
        {!isLoading && !hasSearched ? (
          <p className="empty">Enter a wallet address to inspect its on-chain activity.</p>
        ) : null}
        {!isLoading && transactions.length ? <TransactionTable transactions={transactions} /> : null}
      </section>
    </main>
  );
}

function TransactionTable({ transactions }) {
  return (
    <div className="table-wrap">
      <table className="wallet-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Activity</th>
            <th>Sent</th>
            <th>Received</th>
            <th>Counterparty</th>
            <th>Fee</th>
            <th>Hash</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.hash}>
              <td>{new Date(transaction.timestamp).toLocaleString()}</td>
              <td>
                <span className={`tx-type ${transaction.type}`}>{formatType(transaction.type)}</span>
                <strong className="tx-summary">{transaction.summary}</strong>
                {transaction.status === "failed" ? <span className="failed-text">Failed</span> : null}
              </td>
              <td><AssetList assets={transaction.sentAssets} direction="sent" /></td>
              <td><AssetList assets={transaction.receivedAssets} direction="received" /></td>
              <td><Address value={transaction.counterparty} /></td>
              <td>{transaction.fee ? `${transaction.fee.amount} ${transaction.fee.symbol}` : "N/A"}</td>
              <td>
                <a className="hash-link" href={transaction.explorerUrl} target="_blank" rel="noreferrer">
                  {shortAddress(transaction.hash)}
                  <ExternalLink size={14} />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssetList({ assets, direction }) {
  if (!assets.length) return <span className="muted-text">None</span>;
  return (
    <div className={`asset-list ${direction}`}>
      {assets.map((asset) => (
        <span key={`${asset.contractAddress || "native"}-${asset.symbol}`}>
          {direction === "sent" ? <ArrowRight size={13} /> : <ArrowLeft size={13} />}
          {asset.amount} {asset.symbol}
        </span>
      ))}
    </div>
  );
}

function Address({ value }) {
  if (!value) return <span className="muted-text">Unknown</span>;
  return <code title={value}>{shortAddress(value)}</code>;
}

function shortAddress(value) {
  return value ? `${value.slice(0, 8)}...${value.slice(-6)}` : "";
}

function formatType(type) {
  return type.replace("_", " ");
}

function validateSearch({ address, startDate, endDate }) {
  if (!isEvmAddress(address)) return "Enter a valid EVM wallet address.";
  if (!startDate || !endDate) return "Choose a start and end date.";
  if (startDate > endDate) return "Start date must be on or before end date.";
  const days = (new Date(`${endDate}T00:00:00Z`) - new Date(`${startDate}T00:00:00Z`)) / 86_400_000;
  if (days > 366) return "Choose a date range of 366 days or less.";
  return "";
}
