# OneDay Books setup

Plain steps, one at a time. Nothing here costs money. When something needs a
decision or a key from you, I will walk you through it in chat too.

## Part 1: Connect the cloud database (Supabase)

### Step 1. Make a free Supabase project

1. Go to supabase.com and sign in.
2. Click New project.
3. Pick the Free plan.
4. Give it a name like "oneday-books".
5. Set a database password and save it somewhere safe.
6. Click Create. It takes a minute to set up.

### Step 2. Copy your two keys

1. In the project, open Project Settings (the gear).
2. Click API.
3. Copy the Project URL.
4. Copy the anon public key.

Both of these are safe to share. They are meant for the browser.

### Step 3. Put the keys in the app

1. In the books folder, make a file named `.env.local`.
2. Use `.env.local.example` as the guide. It looks like this:

```
NEXT_PUBLIC_SUPABASE_URL=your project url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your anon public key
```

Leave the AI keys blank for now. The AI help switch stays off, so the app stays
free.

### Step 4. Create the tables

1. In Supabase, open the SQL Editor.
2. Click New query.
3. Open the file `supabase/migrations/0001_init.sql` from this folder, copy all
   of it, and paste it in.
4. Click Run. It creates your tables and turns on row level security.

### Step 5. Turn on email login

1. In Supabase, open Authentication, then Providers.
2. Make sure Email is on.
3. Open Authentication, then URL Configuration.
4. Set the Site URL to where the app runs. For local work that is
   `http://localhost:3000`. For the live app it is your Vercel address.
5. Add the same address plus `/auth/callback` to the Redirect URLs.

### Step 6. Start the app and set up your books

1. Run `npm run dev` in the books folder.
2. Open the app, enter your email, and click the link it sends you.
3. On the dashboard, tap Set up my books. This creates Sound Society LLC with
   its brands, Personal, and your full chart of accounts.

## Part 2: Put it online so your phone can install it (Vercel)

Vercel is free for this and signs in with your GitHub, no card needed.

### Step 1. Sign in to Vercel

1. Go to vercel.com and sign in with GitHub.

### Step 2. Import this repo

1. Click Add New, then Project.
2. Pick this repository.
3. Set the Root Directory to `books` so Vercel builds only this app.

### Step 3. Add your keys

1. In the project settings, open Environment Variables.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` with the
   same values from your `.env.local`.

### Step 4. Deploy

1. Click Deploy. In a minute you get a web address.
2. Go back to Supabase and add that address, and that address plus
   `/auth/callback`, to the Redirect URLs from Part 1 Step 5.

## Part 3: Install on each device

### iPhone

1. Open your Vercel address in Safari.
2. Tap the Share button.
3. Tap Add to Home Screen.
4. Open OneDay Books from your home screen. It runs like an app.

### Laptop and Mac Mini

1. Open the same address in your browser.
2. On Chrome or Edge you can also click Install from the address bar to get an
   app window.

All three stay in sync because they share the one Supabase database.

## Keeping it free

- Supabase free projects go to sleep after a week with no activity. The Mac
  Mini helper in a later milestone keeps it awake with a nightly check, so you
  never have to wake it by hand.
- The AI help switch stays off until you choose to turn it on.
- Plaid bank sync is added in a later milestone, and only after we confirm it
  is free for your accounts.
