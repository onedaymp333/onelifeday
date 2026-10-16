import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntityWithAccounts } from "./types";
import type { RawEntry } from "./entry-view";
import type { SummaryRow } from "./ledger";

/** Load the entities, their chart of accounts, and brands, for the forms. */
export async function loadEntitiesWithAccounts(
  supabase: SupabaseClient,
): Promise<EntityWithAccounts[]> {
  const { data } = await supabase
    .from("entities")
    .select(
      "id, name, is_personal, accounts(id, code, name, type, subtype), brands(id, name)",
    )
    .order("is_personal", { ascending: true })
    .order("name", { ascending: true });

  return (data ?? []).map((e: any) => ({
    id: e.id,
    name: e.name,
    is_personal: e.is_personal,
    accounts: (e.accounts ?? []).sort((a: any, b: any) =>
      a.code.localeCompare(b.code),
    ),
    brands: (e.brands ?? []).sort((a: any, b: any) =>
      a.name.localeCompare(b.name),
    ),
  }));
}

/** Load recent transactions, newest first, optionally for one entity. */
export async function loadRecentEntries(
  supabase: SupabaseClient,
  entityId: string | null,
  limit = 50,
): Promise<RawEntry[]> {
  let query = supabase
    .from("journal_entries")
    .select(
      "id, entry_date, memo, source, entity_id, entities(name), journal_lines(amount_cents, brand_id, brands(name), accounts(name, type, subtype))",
    )
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (entityId) {
    query = query.eq("entity_id", entityId);
  }

  const { data } = await query;
  return (data ?? []) as unknown as RawEntry[];
}

/** Load the rows the dashboard needs to add up cash, income, and expenses. */
export async function loadSummaryRows(
  supabase: SupabaseClient,
  entityId: string | null,
): Promise<SummaryRow[]> {
  let query = supabase
    .from("journal_lines")
    .select("amount_cents, entity_id, accounts(type, subtype), journal_entries(entry_date)")
    .limit(5000);

  if (entityId) {
    query = query.eq("entity_id", entityId);
  }

  const { data } = await query;
  return (data ?? []).map((row: any) => ({
    amountCents: row.amount_cents,
    type: row.accounts?.type,
    subtype: row.accounts?.subtype ?? null,
    entryDate: row.journal_entries?.entry_date,
  }));
}
