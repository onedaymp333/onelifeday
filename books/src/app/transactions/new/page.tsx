import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseEnv } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadEntitiesWithAccounts } from "@/lib/data";
import NotConfigured from "@/components/NotConfigured";
import AddTransactionForm from "@/components/AddTransactionForm";

export const dynamic = "force-dynamic";

export default async function NewTransactionPage() {
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
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8 pb-28">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Add transaction</h1>
        <Link href="/dashboard" className="text-sm text-white/50">
          Close
        </Link>
      </header>
      <AddTransactionForm entities={entities} />
    </main>
  );
}
