# Public Release Checklist

## Implemented

- Landing page with register/login/dashboard paths.
- Clerk sign-in and sign-up pages.
- Protected dashboard route.
- Protected ledger API routes.
- Per-user Neon schema.
- JSON and CSV export.
- JSON/CSV import with review, merge, replace, and validation.
- Local browser ledger migration into the logged-in account.
- Dark mode via device preference.
- Vercel config and env example.
- `/api/health` setup check.
- Vitest unit tests for parser/import/export logic.
- Playwright smoke tests for public setup and guarded dashboard pages.

## Needs Your Account Access Later

1. Create or connect the GitHub repo.
2. Create/import the Vercel project.
3. Add Clerk from Vercel Marketplace or Clerk dashboard.
4. Add Neon from Vercel Marketplace or Neon dashboard.
5. Run `db/schema.sql` in Neon.
6. Pull env vars locally with `vercel env pull .env.local`.
7. Verify the production deployment.

## Automated Verification

```bash
npm run test
npm run build
npm audit --omit=dev
PLAYWRIGHT_BASE_URL=<deployment-url> npm run test:e2e
```

## Suggested First Production Test

1. Register a new account.
2. Add `I bought 100 usdc for 89 euro`.
3. Add `I bought 0.002 btc for 80 usdc`.
4. Export JSON and CSV.
5. Delete one row.
6. Import the JSON backup using replace.
7. Confirm the two rows return.
