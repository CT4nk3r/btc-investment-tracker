# BTC Investment Tracker

Authenticated crypto tax ledger for tracking chains like:

- `I bought 100 usdc for 89 euro`
- `I bought 0.002 btc for 80 usdc`

The app uses Clerk for login/register, Neon Postgres for per-user ledger storage, and Next.js API routes for protected data access. It estimates holdings, follows FIFO cost basis from EUR into stablecoins and crypto, fetches live EUR values for common crypto assets, and exports CSV/JSON for tax preparation.

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

## Data Portability

- JSON export is the canonical backup format.
- CSV export is for spreadsheets and tax/accounting workflows.
- Import supports JSON backups, older raw JSON ledger arrays, and CSV files exported by the app.
- If an old browser-local ledger exists, the dashboard offers to merge it into the logged-in account.

This is a tax filing helper, not tax advice.
