import { redirect } from "next/navigation";
import { getSupabaseEnv } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import NotConfigured from "@/components/NotConfigured";
import SignOutButton from "@/components/SignOutButton";
import SetupBooks from "./SetupBooks";

export const dynamic = "force-dynamic";

const TAX_LABELS: Record<string, string> = {
  schedule_c: "Schedule C",
  s_corp: "S corp",
  personal: "Personal",
  partnership: "Partnership",
};

interface EntityRow {
  id: string;
  name: string;
  tax_treatment: string;
  is_personal: boolean;
  brands: { name: string }[];
  accounts: { id: string }[];
}

export default async function Dashboard() {
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

  const { data } = await supabase
    .from("entities")
    .select("id, name, tax_treatment, is_personal, brands(name), accounts(id)")
    .order("is_personal", { ascending: true })
    .order("name", { ascending: true });

  const entities = (data ?? []) as EntityRow[];
  const hasBooks = entities.length > 0;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand-soft">
            OneDay Books
          </p>
          <h1 className="mt-1 text-xl font-semibold">Dashboard</h1>
        </div>
        <SignOutButton />
      </header>

      {/* Needs your review. A real count arrives with the ledger milestone. */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Needs your review" value="0" accent />
        <Tile label="Cash on hand" value="$0" />
        <Tile label="Income this month" value="$0" />
        <Tile label="Expenses this month" value="$0" />
      </section>

      {!hasBooks ? (
        <section className="mt-8">
          <SetupBooks />
        </section>
      ) : (
        <section className="mt-8 space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-white/50">
            Your books
          </h2>
          {entities.map((e) => (
            <div key={e.id} className="rounded-2xl bg-ink-soft p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-semibold">{e.name}</p>
                  <p className="mt-0.5 text-sm text-white/50">
                    {TAX_LABELS[e.tax_treatment] ?? e.tax_treatment} ·{" "}
                    {e.accounts.length} categories
                  </p>
                </div>
              </div>
              {e.brands.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {e.brands.map((b) => (
                    <span
                      key={b.name}
                      className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80"
                    >
                      {b.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-white/50">
            Combined view across all books lands with the dashboard milestone.
          </div>
        </section>
      )}

      <footer className="mt-10 border-t border-white/10 pt-4 text-xs text-white/40">
        OneDay Books gives software assistance, not licensed CPA advice.
        Anything uncertain gets flagged for you or your tax pro.
      </footer>
    </main>
  );
}

function Tile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-4 ${
        accent ? "bg-brand/20 ring-1 ring-brand/40" : "bg-ink-soft"
      }`}
    >
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-white/50">{label}</p>
    </div>
  );
}
