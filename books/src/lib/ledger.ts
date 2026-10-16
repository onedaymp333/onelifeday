/**
 * The double entry ledger, in plain terms.
 *
 * Every transaction becomes two or more lines that add up to exactly zero.
 * Amounts are whole cents in "debit positive" form: a debit is a positive
 * number, a credit is a negative number. You never see this in the app. This
 * file turns a simple choice like "money in, Weddings, into Checking" into the
 * correct balanced lines, and adds up balances for the dashboard.
 */

import type { Cents } from "./money";
import type { AccountType } from "./chart-of-accounts";

export type TxnType =
  | "income"
  | "expense"
  | "transfer"
  | "owner_draw"
  | "owner_in";

export interface LedgerLine {
  accountId: string;
  amountCents: Cents;
  brandId?: string | null;
}

export interface PlanInput {
  type: TxnType;
  amountCents: Cents;
  /** The income or expense category chosen. */
  categoryAccountId?: string;
  /** The bank, cash, or card account the money moves through. */
  moneyAccountId?: string;
  /** The other account, for a transfer (the destination). */
  secondMoneyAccountId?: string;
  /** The owner draws or owner money in account, chosen for you by type. */
  ownerAccountId?: string;
  brandId?: string | null;
}

/** Friendly labels and the fields each transaction type needs. */
export const TXN_TYPES: Record<
  TxnType,
  { label: string; help: string; direction: "in" | "out" | "move" }
> = {
  income: {
    label: "Money in",
    help: "A payment you received.",
    direction: "in",
  },
  expense: {
    label: "Money out",
    help: "Something you paid for.",
    direction: "out",
  },
  transfer: {
    label: "Transfer",
    help: "Moving money between your own accounts.",
    direction: "move",
  },
  owner_draw: {
    label: "Owner draw",
    help: "Money you took out for yourself.",
    direction: "out",
  },
  owner_in: {
    label: "Owner money in",
    help: "Your own money you put into the business.",
    direction: "in",
  },
};

function requireId(value: string | undefined, field: string): string {
  if (!value) {
    throw new Error(`Missing ${field}`);
  }
  return value;
}

/**
 * Turn a simple transaction into balanced ledger lines. Debit is positive,
 * credit is negative, and the two always sum to zero.
 */
export function planLines(input: PlanInput): LedgerLine[] {
  const { type, amountCents, brandId = null } = input;

  if (!Number.isInteger(amountCents)) {
    throw new Error("Amount must be whole cents");
  }
  if (amountCents <= 0) {
    throw new Error("Amount must be more than zero");
  }

  let debitAccountId: string;
  let creditAccountId: string;

  switch (type) {
    case "income":
      debitAccountId = requireId(input.moneyAccountId, "deposit account");
      creditAccountId = requireId(input.categoryAccountId, "income category");
      break;
    case "expense":
      debitAccountId = requireId(input.categoryAccountId, "expense category");
      creditAccountId = requireId(input.moneyAccountId, "paid from account");
      break;
    case "transfer":
      debitAccountId = requireId(input.secondMoneyAccountId, "to account");
      creditAccountId = requireId(input.moneyAccountId, "from account");
      break;
    case "owner_draw":
      debitAccountId = requireId(input.ownerAccountId, "owner draws account");
      creditAccountId = requireId(input.moneyAccountId, "from account");
      break;
    case "owner_in":
      debitAccountId = requireId(input.moneyAccountId, "to account");
      creditAccountId = requireId(input.ownerAccountId, "owner money in account");
      break;
    default: {
      const never: never = type;
      throw new Error(`Unknown transaction type ${never}`);
    }
  }

  if (debitAccountId === creditAccountId) {
    throw new Error("Pick two different accounts");
  }

  return [
    { accountId: debitAccountId, amountCents, brandId },
    { accountId: creditAccountId, amountCents: -amountCents, brandId },
  ];
}

/** True when the lines add up to zero, which is what balanced means. */
export function isBalanced(lines: LedgerLine[]): boolean {
  return sumLines(lines) === 0;
}

/** Throws if the lines are not balanced. The ledger must never go out of balance. */
export function assertBalanced(lines: LedgerLine[]): void {
  const total = sumLines(lines);
  if (total !== 0) {
    throw new Error(`Entry is not balanced (off by ${total} cents)`);
  }
}

export function sumLines(lines: LedgerLine[]): Cents {
  return lines.reduce((total, l) => total + l.amountCents, 0);
}

/**
 * Turn a raw debit positive balance into the number a person expects to see.
 * Assets and expenses read naturally as their debit balance. Liabilities,
 * equity, and income read as the opposite, so they show as positive.
 */
export function normalizedBalance(
  type: AccountType,
  debitBalanceCents: Cents,
): Cents {
  if (type === "asset" || type === "expense") {
    return debitBalanceCents;
  }
  return -debitBalanceCents;
}

export interface SummaryRow {
  amountCents: Cents;
  type: AccountType;
  subtype?: string | null;
  entryDate: string; // YYYY-MM-DD
}

export interface DashboardSummary {
  cashCents: Cents;
  incomeCents: Cents;
  expenseCents: Cents;
  netCents: Cents;
}

/**
 * Add up the dashboard numbers from ledger lines. Cash on hand is the all time
 * balance of your bank and cash accounts. Income and expenses are only counted
 * inside the date range you pass.
 */
export function computeDashboard(
  rows: SummaryRow[],
  range: { from: string; to: string },
): DashboardSummary {
  let cash = 0;
  let income = 0;
  let expense = 0;

  for (const r of rows) {
    const inRange = r.entryDate >= range.from && r.entryDate <= range.to;

    if (r.type === "asset" && (r.subtype === "bank" || r.subtype === "cash")) {
      cash += r.amountCents; // debit positive is the asset balance
    }
    if (r.type === "income" && inRange) {
      income += -r.amountCents; // income is credit, flip to positive
    }
    if (r.type === "expense" && inRange) {
      expense += r.amountCents; // expense is debit, already positive
    }
  }

  return {
    cashCents: cash,
    incomeCents: income,
    expenseCents: expense,
    netCents: income - expense,
  };
}
