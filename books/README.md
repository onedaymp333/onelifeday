# OneDay Books

AI assisted bookkeeping and tax prep for OneDay, tuned for an entertainment
freelance business. One set of books on your iPhone, your laptop, and your Mac
Mini, all synced through one cloud database.

This folder is a self contained app. It does not touch the games and booking
site that lives in the rest of this repo.

## What is here so far (Milestone 1)

- The app shell, installable on your iPhone as a home screen app (PWA), and
  working offline for its shell.
- Email sign in link login, with your session kept safe across devices.
- Your cloud database tables with row level security, so data is only ever
  yours.
- Your two sets of books and the full chart of accounts, seeded with one tap.
- A money library that stores and does all math in whole cents, with tests, so
  the accounting is correct from day one.

## The money rule

Every amount is stored and computed as a whole number of cents, never as a
floating point dollar value. `$12.34` is the integer `1234`. This avoids the
classic bug where `0.1 + 0.2` is not `0.3` and pennies go missing. See
`src/lib/money.ts` and its tests in `src/lib/money.test.ts`.

## Stack

- Next.js and React with TypeScript (one codebase for phone, laptop, Mac Mini)
- Tailwind CSS for styling
- Supabase for the Postgres database, login, and row level security
- Installable PWA with an offline service worker

## Run it on your computer

```
cd books
npm install
cp .env.local.example .env.local   # then fill in your Supabase keys
npm run dev
```

Open http://localhost:3000. Before keys are added, the app shows friendly setup
steps instead of errors.

## Scripts

- `npm run dev` start the app for local work
- `npm run build` make the production build
- `npm start` run the production build
- `npm test` run the money math tests
- `npm run typecheck` check the types
- `npm run make-icons` regenerate the app icons

## Folder map

```
books/
  src/
    app/           pages: home, login, dashboard, auth callback
    components/     shared UI pieces
    lib/
      money.ts            the whole cents money library
      money.test.ts       its tests
      chart-of-accounts.ts  your categories, mapped to Schedule C
      config.ts           reads environment settings
      supabase/           database clients and session handling
  supabase/
    migrations/0001_init.sql   the database tables and security
  public/          manifest, icons, offline service worker
  scripts/         the icon generator
```

## Security notes

- Row level security is on for every table from the first migration.
- Secrets live only in `.env.local` and your hosting settings, never in the
  repo. `.env.local` is gitignored.
- Full setup, including the one at a time key steps, is in `SETUP.md`.

OneDay Books gives software assistance, not licensed CPA advice. Anything
uncertain gets flagged for you or your tax pro.
