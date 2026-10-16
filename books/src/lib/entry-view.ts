/**
 * Turns the two sided ledger entries back into a plain transaction row for the
 * app: a title, whether money came in, went out, or just moved, and how much.
 */

import type { AccountType } from "./chart-of-accounts";

export interface RawLine {
  amount_cents: number;
  brand_id?: string | null;
  brands?: { name: string } | null;
  accounts: { name: string; type: AccountType; subtype: string | null } | null;
}

export interface RawEntry {
  id: string;
  entry_date: string;
  memo: string | null;
  source: string;
  entity_id: string;
  entities?: { name: string } | null;
  journal_lines: RawLine[];
}

export type Direction = "in" | "out" | "move";

export interface EntryView {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  direction: Direction;
  amountCents: number; // always a positive magnitude
  brandName: string | null;
  entityName: string | null;
  kind: "income" | "expense" | "transfer" | "owner_draw" | "owner_in" | "other";
}

export function summarizeEntry(entry: RawEntry): EntryView {
  const lines = entry.journal_lines ?? [];
  const brandName = lines.find((l) => l.brands)?.brands?.name ?? null;
  const entityName = entry.entities?.name ?? null;
  const assetLine = lines.find((l) => l.accounts?.type === "asset");
  const moneyLine =
    assetLine ?? lines.find((l) => l.accounts?.type === "liability");

  const base = {
    id: entry.id,
    date: entry.entry_date,
    brandName,
    entityName,
  };

  const incomeLine = lines.find((l) => l.accounts?.type === "income");
  if (incomeLine) {
    return {
      ...base,
      kind: "income",
      direction: "in",
      title: incomeLine.accounts?.name ?? "Income",
      subtitle: entry.memo || (moneyLine ? `to ${moneyLine.accounts?.name}` : ""),
      amountCents: Math.abs(incomeLine.amount_cents),
    };
  }

  const expenseLine = lines.find((l) => l.accounts?.type === "expense");
  if (expenseLine) {
    return {
      ...base,
      kind: "expense",
      direction: "out",
      title: expenseLine.accounts?.name ?? "Expense",
      subtitle:
        entry.memo || (moneyLine ? `from ${moneyLine.accounts?.name}` : ""),
      amountCents: Math.abs(expenseLine.amount_cents),
    };
  }

  const drawLine = lines.find((l) => l.accounts?.subtype === "owner_draw");
  if (drawLine) {
    return {
      ...base,
      kind: "owner_draw",
      direction: "out",
      title: "Owner draw",
      subtitle:
        entry.memo || (moneyLine ? `from ${moneyLine.accounts?.name}` : ""),
      amountCents: Math.abs((moneyLine ?? drawLine).amount_cents),
    };
  }

  const contribLine = lines.find(
    (l) => l.accounts?.subtype === "owner_contribution",
  );
  if (contribLine) {
    return {
      ...base,
      kind: "owner_in",
      direction: "in",
      title: "Owner money in",
      subtitle: entry.memo || (moneyLine ? `to ${moneyLine.accounts?.name}` : ""),
      amountCents: Math.abs((moneyLine ?? contribLine).amount_cents),
    };
  }

  // Transfer between your own accounts.
  const debit = lines.find((l) => l.amount_cents > 0);
  const credit = lines.find((l) => l.amount_cents < 0);
  return {
    ...base,
    kind: "transfer",
    direction: "move",
    title: "Transfer",
    subtitle:
      entry.memo ||
      (credit && debit
        ? `${credit.accounts?.name} to ${debit.accounts?.name}`
        : ""),
    amountCents: Math.abs(debit?.amount_cents ?? 0),
  };
}
