import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseEnv } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadEntitiesWithAccounts, loadRecentEntries } from "@/lib/data";
import { summarizeEntry } from "@/lib/entry-view";
import NotConfigured from "@/components/NotConfigured";
import TransactionRow from "@/components/TransactionRow";
import EntityTabs from "@/components/EntityTabs";
import BottomNav from "@/components/BottomNav";

export const dynamic = "force-dynamic";

export default async function TransactionsPage({
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
  const selectedId =
    searchParams.entity && entities.some((e) => e.id === searchParams.entity)
      ? searchParams.entity
      : null;

  const rawEntries = await loadRecentEntries(supabase, selectedId, 100);
  const entries = rawEntries.map(summarizeEntry);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-28">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Activity</h1>
        <Link
          href="/transactions/new"
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium"
        >
          Add
        </Link>
      </header>

      {entities.length > 1 && (
        <div className="mt-4">
          <EntityTabs
            entities={entities}
            currentId={selectedId}
            basePath="/transactions"
          />
        </div>
      )}

      {entries.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-ink-soft p-8 text-center">
          <p className="font-medium">No transactions yet</p>
          <p className="mt-1 text-sm text-white/50">
            Add your first one and it shows up here.
          </p>
          <Link
            href="/transactions/new"
            className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium"
          >
            Add transaction
          </Link>
        </div>
      ) : (
        <div className="mt-4 divide-y divide-white/5 rounded-2xl bg-ink-soft px-4">
          {entries.map((e) => (
            <TransactionRow key={e.id} entry={e} showEntity={!selectedId} />
          ))}
        </div>
      )}

      <BottomNav />
    </main>
  );
}
