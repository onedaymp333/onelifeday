import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseEnv } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  loadEntitiesWithAccounts,
  loadRecentEntries,
  loadSummaryRows,
} from "@/lib/data";
import { computeDashboard } from "@/lib/ledger";
import { summarizeEntry } from "@/lib/entry-view";
import { currentMonthRange } from "@/lib/dates";
import { formatUSD } from "@/lib/money";
import NotConfigured from "@/components/NotConfigured";
import SignOutButton from "@/components/SignOutButton";
import SetupBooks from "./SetupBooks";
import EntityTabs from "@/components/EntityTabs";
import TransactionRow from "@/components/TransactionRow";
import BottomNav from "@/components/BottomNav";

export const dynamic = "force-dynamic";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: { entity?: string };
}) {
  if (!getSupabaseEnv().configured) {
    return <NotConfigured />;
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const entities = await loadEntitiesWithAccounts(supabase);

  if (entities.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Header />
        <section className="mt-8">
          <SetupBooks />
        </section>
        <Disclaimer />
      </main>
    );
  }

  const selectedId =
    searchParams.entity && entities.some((e) => e.id === searchParams.entity)
      ? searchParams.entity
      : null;

  const month = currentMonthRange();
  const [summaryRows, rawEntries] = await Promise.all([
    loadSummaryRows(supabase, selectedId),
    loadRecentEntries(supabase, selectedId, 8),
  ]);

  const summary = computeDashboard(summaryRows, {
    from: month.from,
    to: month.to,
  });
  const recent = rawEntries.map(summarizeEntry);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-28">
      <Header />

      {entities.length > 1 && (
        <div className="mt-5">
          <EntityTabs
            entities={entities}
            currentId={selectedId}
            basePath="/dashboard"
          />
        </div>
      )}

      <p className="mt-5 text-xs uppercase tracking-wide text-white/40">
        {month.label}
      </p>
      <section className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Cash on hand" value={formatUSD(summary.cashCents)} accent />
        <Tile label="Income" value={formatUSD(summary.incomeCents)} tone="in" />
        <Tile
          label="Expenses"
          value={formatUSD(summary.expenseCents)}
          tone="out"
        />
        <Tile
          label="Net profit"
          value={formatUSD(summary.netCents)}
          tone={summary.netCents >= 0 ? "in" : "out"}
        />
      </section>

      <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 text-sm text-white/60">
        <span className="font-semibold text-white/80">Needs your review: 0</span>
        <span className="text-white/40">
          The review queues arrive with the AI milestone.
        </span>
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-white/50">
            Recent
          </h2>
          <Link href="/transactions" className="text-sm text-brand-soft">
            See all
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="mt-3 rounded-2xl bg-ink-soft p-8 text-center">
            <p className="font-medium">No transactions yet</p>
            <p className="mt-1 text-sm text-white/50">
              Tap the plus to add your first one.
            </p>
            <Link
              href="/transactions/new"
              className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium"
            >
              Add transaction
            </Link>
          </div>
        ) : (
          <div className="mt-3 divide-y divide-white/5 rounded-2xl bg-ink-soft px-4">
            {recent.map((e) => (
              <TransactionRow key={e.id} entry={e} showEntity={!selectedId} />
            ))}
          </div>
        )}
      </section>

      <Disclaimer />
      <BottomNav />
    </main>
  );
}

function Header() {
  return (
    <header className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-brand-soft">
          OneDay Books
        </p>
        <h1 className="mt-1 text-xl font-semibold">Dashboard</h1>
      </div>
      <SignOutButton />
    </header>
  );
}

function Disclaimer() {
  return (
    <footer className="mt-10 border-t border-white/10 pt-4 text-xs text-white/40">
      OneDay Books gives software assistance, not licensed CPA advice. Anything
      uncertain gets flagged for you or your tax pro.
    </footer>
  );
}

function Tile({
  label,
  value,
  accent,
  tone,
}: {
  label: string;
  value: string;
  accent?: boolean;
  tone?: "in" | "out";
}) {
  const valueColor =
    tone === "in"
      ? "text-money-in"
      : tone === "out"
        ? "text-money-out"
        : "text-white";
  return (
    <div
      className={`rounded-xl p-4 ${
        accent ? "bg-brand/20 ring-1 ring-brand/40" : "bg-ink-soft"
      }`}
    >
      <p className={`text-2xl font-semibold ${valueColor}`}>{value}</p>
      <p className="mt-1 text-xs text-white/50">{label}</p>
    </div>
  );
}
