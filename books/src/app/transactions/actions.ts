"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { planLines } from "@/lib/ledger";
import type { AddTxnInput } from "@/lib/types";

export interface AddTxnResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * Posts a manual transaction. Builds the balanced ledger lines, then posts them
 * through the database function that refuses anything out of balance.
 */
export async function addTransaction(
  input: AddTxnInput,
): Promise<AddTxnResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You are not signed in." };
  }

  if (!input.entityId) {
    return { ok: false, error: "Pick which books this belongs to." };
  }
  if (!input.entryDate) {
    return { ok: false, error: "Pick a date." };
  }

  let lines;
  try {
    lines = planLines({
      type: input.type,
      amountCents: input.amountCents,
      categoryAccountId: input.categoryAccountId,
      moneyAccountId: input.moneyAccountId,
      secondMoneyAccountId: input.secondMoneyAccountId,
      ownerAccountId: input.ownerAccountId,
      brandId: input.brandId ?? null,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "That entry did not add up.",
    };
  }

  const payload = lines.map((l) => ({
    account_id: l.accountId,
    amount_cents: l.amountCents,
    brand_id: l.brandId ?? null,
  }));

  const { data, error } = await supabase.rpc("post_entry", {
    p_entity: input.entityId,
    p_date: input.entryDate,
    p_memo: input.memo ?? "",
    p_source: "manual",
    p_lines: payload,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  return { ok: true, id: data as string };
}
