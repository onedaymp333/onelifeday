"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { startingEntities } from "@/lib/chart-of-accounts";

export interface SetupResult {
  ok: boolean;
  already?: boolean;
  error?: string;
}

/**
 * First time setup. Creates your two sets of books, the brands inside Sound
 * Society LLC, and the full chart of accounts, then writes an audit entry.
 * Safe to run more than once: it does nothing if books already exist.
 */
export async function setupBooks(): Promise<SetupResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You are not signed in." };
  }

  const { count } = await supabase
    .from("entities")
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) {
    return { ok: true, already: true };
  }

  for (const e of startingEntities) {
    const { data: entity, error: entityError } = await supabase
      .from("entities")
      .insert({
        name: e.name,
        slug: e.slug,
        tax_treatment: e.taxTreatment,
        is_personal: e.isPersonal,
      })
      .select("id")
      .single();

    if (entityError || !entity) {
      return {
        ok: false,
        error: entityError?.message ?? "Could not create your books.",
      };
    }

    if (e.brands.length > 0) {
      const { error: brandError } = await supabase.from("brands").insert(
        e.brands.map((b) => ({
          entity_id: entity.id,
          name: b.name,
          slug: b.slug,
        })),
      );
      if (brandError) {
        return { ok: false, error: brandError.message };
      }
    }

    const { error: accountError } = await supabase.from("accounts").insert(
      e.chart.map((a) => ({
        entity_id: entity.id,
        code: a.code,
        name: a.name,
        type: a.type,
        subtype: a.subtype ?? null,
        schedule_c_line: a.scheduleCLine ?? null,
        note: a.note ?? null,
      })),
    );
    if (accountError) {
      return { ok: false, error: accountError.message };
    }

    await supabase.from("audit_log").insert({
      entity_id: entity.id,
      actor: "owner",
      action: "insert",
      table_name: "entities",
      row_id: entity.id,
      reason: "First time setup created this set of books.",
      new_value: {
        name: e.name,
        brands: e.brands.length,
        accounts: e.chart.length,
      },
    });
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
