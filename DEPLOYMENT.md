# Deployment Notes

The app is prepared for public deployment as a Next.js app on Vercel.

## Account Setup

Install these Vercel Marketplace integrations or create equivalent external services:

```bash
vercel integration add clerk
vercel integration add neon
```

Required environment variables:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
DATABASE_URL=
```

Wallet transaction history uses Blockscout's public API, so there is no additional required environment variable or secret for the current provider. If a keyed explorer provider is added later, keep its API key server-side and configure it for Preview and Production environments.

## Database

Run [db/schema.sql](db/schema.sql) in Neon before opening the app to users.

The table stores ledger rows by Clerk `user_id`, so users can only access rows through authenticated API routes.

## Deploy Manually

```bash
npm install
npm run build
npx vercel
```

For production:

```bash
npx vercel --prod
```

## Deploy Through GitHub

1. Push this repository to GitHub.
2. Import the repo in Vercel.
3. Set the Vercel project environment variables.
4. Run the Neon schema.
5. Deploy.

Vercel should use:

- Build command: `npm run build`
- Install command: `npm install`

## Health Check

`/api/health` reports whether Clerk and Neon env vars are configured.

## Public Release Checklist

- Clerk production instance configured.
- Neon database created and schema applied.
- Vercel env vars set for Production and Preview.
- `npm run build` passes.
- Register, login, add trade, delete trade, import JSON, export JSON, export CSV verified.
- Wallet activity lookup verified for a supported EVM address and date range.
- Terms/privacy text added if this will be used by people beyond you.
