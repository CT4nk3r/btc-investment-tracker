# BTC Investment Tracker

Authenticated crypto tax ledger for tracking chains like:

- `I bought 100 usdc for 89 euro`
- `I bought 0.002 btc for 80 usdc`

The app uses Clerk for login/register, Neon Postgres for per-user ledger storage, and Next.js API routes for protected data access. It estimates holdings, follows FIFO cost basis from EUR into stablecoins and crypto, fetches live EUR values for common crypto assets, and exports CSV/JSON for tax preparation.

The authenticated wallet activity page can inspect Ethereum-compatible wallet addresses by date range and import selected supported activity into the portfolio ledger. It currently supports Ethereum, Polygon, Base, and Arbitrum One using Blockscout's public explorer API, then normalizes native transfers, ERC-20 transfers, fees, contract interactions, and reliably detectable swaps into one transaction view.

Wallet imports use deterministic chain transaction IDs, so importing the same activity again does not create duplicates. Clear swaps become trades, incoming and outgoing transfers use an internal external-wallet balancing entry, and outgoing network fees become expense entries. Failed transactions, unsupported assets, and undecoded contract calls remain visible but cannot be imported.

Wallet-imported ledger rows retain source evidence including chain, wallet address, transaction hash, explorer URL, block number, counterparty, method, status, fee, and complete sent/received asset flows. Searching a wallet also enriches matching older imports without creating new ledger rows.

## Run Locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without Clerk and Neon env vars, the app shows a setup screen and `/api/health` lists what is missing.

## Verify

```bash
npm run test
npm run build
npm audit --omit=dev
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 npm run test:e2e
```

Run the Playwright command while the dev server is running.

## Required Services

- Clerk: login/register and protected routes.
- Neon Postgres: ledger rows stored by authenticated user ID.
- Vercel: hosting and environment variable management.

## Wallet Explorer Provider

Wallet activity uses Blockscout's public server-side API and does not require an additional API key. Provider calls are made only from `/api/wallet-transactions`; the browser never calls the explorer directly.

The provider is isolated in `lib/wallet-provider.js`, so a keyed Etherscan or another explorer adapter can be added later without changing the UI's normalized transaction model.

Current limitations:

- Wallet lookup supports EVM addresses, not native Bitcoin addresses.
- Swap summaries are inferred from outgoing and incoming native/ERC-20 flows. Complex multi-hop swaps, internal transfers, NFTs, approvals, bridges, and protocol-specific actions may appear as transfers or undecoded contract interactions.
- Results are capped per activity source. Use a shorter date range when the UI reports that the result limit was reached.

## Data Portability

- JSON export is the canonical backup format.
- CSV export is for spreadsheets and tax/accounting workflows.
- Tax CSV adds source type, chain, transaction hash, explorer URL, UTC timestamp, asset flows, and unit-price columns for accountant review.
- Evidence JSON includes all ledger records, source links, calculation methodology, current holdings and basis summary, the export-time rate snapshot, and a SHA-256 integrity fingerprint.
- Import supports JSON backups, older raw JSON ledger arrays, and CSV files exported by the app.
- If an old browser-local ledger exists, the dashboard offers to merge it into the logged-in account.

The evidence package is supporting documentation, not a guarantee of acceptance by a tax authority. Keep exchange statements, bank records, and explorer records alongside it. This is a tax filing helper, not tax advice.
