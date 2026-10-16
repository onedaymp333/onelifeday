/**
 * Shown when the app has no Supabase keys yet. Plain, friendly setup steps so
 * nothing looks broken before the keys are added.
 */
export default function NotConfigured() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-4 py-12">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand-soft">
          OneDay Books
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Almost ready</h1>
        <p className="mt-2 text-white/70">
          The app is installed and running. It just needs to be connected to
          your cloud database so your books sync across your phone, laptop, and
          Mac Mini.
        </p>
      </div>

      <ol className="space-y-4">
        <Step n={1} title="Make a free Supabase project">
          Go to supabase.com, sign in, and create a new project. Pick the free
          plan. Write down the database password it asks you to set.
        </Step>
        <Step n={2} title="Copy two keys">
          In the project, open Project Settings, then API. Copy the Project URL
          and the anon public key. Both are safe to share.
        </Step>
        <Step n={3} title="Paste them in">
          Put them in a file named .env.local next to the app, using
          .env.local.example as the guide. Then restart the app.
        </Step>
        <Step n={4} title="Create the tables">
          In Supabase, open the SQL Editor and run the file at
          supabase/migrations/0001_init.sql. Full walkthrough is in SETUP.md.
        </Step>
      </ol>

      <p className="text-sm text-white/50">
        I will give you these steps one at a time in chat too. Nothing here
        costs money.
      </p>
    </main>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4 rounded-xl bg-ink-soft p-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold">
        {n}
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-white/60">{children}</p>
      </div>
    </li>
  );
}
