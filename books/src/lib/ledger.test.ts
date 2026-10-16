import { describe, it, expect } from "vitest";
import {
  planLines,
  isBalanced,
  assertBalanced,
  sumLines,
  normalizedBalance,
  computeDashboard,
  type SummaryRow,
} from "./ledger";

const BANK = "acct-bank";
const SAVINGS = "acct-savings";
const WEDDINGS = "acct-weddings";
const SOFTWARE = "acct-software";
const DRAWS = "acct-draws";
const CONTRIB = "acct-contrib";
const BRAND = "brand-oneday";

describe("planLines", () => {
  it("income debits the deposit account and credits the income category", () => {
    const lines = planLines({
      type: "income",
      amountCents: 50000,
      moneyAccountId: BANK,
      categoryAccountId: WEDDINGS,
      brandId: BRAND,
    });
    expect(lines).toEqual([
      { accountId: BANK, amountCents: 50000, brandId: BRAND },
      { accountId: WEDDINGS, amountCents: -50000, brandId: BRAND },
    ]);
    expect(isBalanced(lines)).toBe(true);
  });

  it("expense debits the category and credits the account it was paid from", () => {
    const lines = planLines({
      type: "expense",
      amountCents: 12000,
      categoryAccountId: SOFTWARE,
      moneyAccountId: BANK,
    });
    expect(lines[0]).toEqual({
      accountId: SOFTWARE,
      amountCents: 12000,
      brandId: null,
    });
    expect(lines[1]).toEqual({
      accountId: BANK,
      amountCents: -12000,
      brandId: null,
    });
    expect(isBalanced(lines)).toBe(true);
  });

  it("transfer moves money from one account to another, balanced", () => {
    const lines = planLines({
      type: "transfer",
      amountCents: 20000,
      moneyAccountId: BANK,
      secondMoneyAccountId: SAVINGS,
    });
    expect(lines).toEqual([
      { accountId: SAVINGS, amountCents: 20000, brandId: null },
      { accountId: BANK, amountCents: -20000, brandId: null },
    ]);
    expect(sumLines(lines)).toBe(0);
  });

  it("owner draw debits owner draws and credits the account money left", () => {
    const lines = planLines({
      type: "owner_draw",
      amountCents: 30000,
      ownerAccountId: DRAWS,
      moneyAccountId: BANK,
    });
    expect(lines[0].accountId).toBe(DRAWS);
    expect(lines[1].accountId).toBe(BANK);
    expect(isBalanced(lines)).toBe(true);
  });

  it("owner money in debits the account and credits owner money in", () => {
    const lines = planLines({
      type: "owner_in",
      amountCents: 40000,
      moneyAccountId: BANK,
      ownerAccountId: CONTRIB,
    });
    expect(lines[0].accountId).toBe(BANK);
    expect(lines[1].accountId).toBe(CONTRIB);
    expect(isBalanced(lines)).toBe(true);
  });

  it("rejects bad amounts and missing or duplicate accounts", () => {
    expect(() =>
      planLines({ type: "income", amountCents: 0, moneyAccountId: BANK, categoryAccountId: WEDDINGS }),
    ).toThrow();
    expect(() =>
      planLines({ type: "income", amountCents: -5, moneyAccountId: BANK, categoryAccountId: WEDDINGS }),
    ).toThrow();
    expect(() =>
      planLines({ type: "income", amountCents: 100, categoryAccountId: WEDDINGS }),
    ).toThrow();
    expect(() =>
      planLines({ type: "transfer", amountCents: 100, moneyAccountId: BANK, secondMoneyAccountId: BANK }),
    ).toThrow();
  });
});

describe("assertBalanced", () => {
  it("accepts a balanced set and rejects an unbalanced one", () => {
    expect(() =>
      assertBalanced([
        { accountId: BANK, amountCents: 100 },
        { accountId: WEDDINGS, amountCents: -100 },
      ]),
    ).not.toThrow();
    expect(() =>
      assertBalanced([
        { accountId: BANK, amountCents: 100 },
        { accountId: WEDDINGS, amountCents: -99 },
      ]),
    ).toThrow();
  });
});

describe("normalizedBalance", () => {
  it("reads assets and expenses as their debit balance", () => {
    expect(normalizedBalance("asset", 50000)).toBe(50000);
    expect(normalizedBalance("expense", 12000)).toBe(12000);
  });
  it("flips liabilities, equity, and income to show positive", () => {
    expect(normalizedBalance("income", -50000)).toBe(50000);
    expect(normalizedBalance("liability", -20000)).toBe(20000);
    expect(normalizedBalance("equity", -30000)).toBe(30000);
  });
});

describe("computeDashboard", () => {
  // A wedding deposit of $500 into Checking on Mar 3, and $120 of software
  // paid from Checking on Mar 10.
  const rows: SummaryRow[] = [
    { amountCents: 50000, type: "asset", subtype: "bank", entryDate: "2026-03-03" },
    { amountCents: -50000, type: "income", subtype: null, entryDate: "2026-03-03" },
    { amountCents: 12000, type: "expense", subtype: null, entryDate: "2026-03-10" },
    { amountCents: -12000, type: "asset", subtype: "bank", entryDate: "2026-03-10" },
  ];

  it("adds up cash, income, expenses, and net for the month", () => {
    const s = computeDashboard(rows, { from: "2026-03-01", to: "2026-03-31" });
    expect(s.cashCents).toBe(38000); // 500 in minus 120 out
    expect(s.incomeCents).toBe(50000);
    expect(s.expenseCents).toBe(12000);
    expect(s.netCents).toBe(38000);
  });

  it("counts cash all time but income and expenses only inside the range", () => {
    const s = computeDashboard(rows, { from: "2026-04-01", to: "2026-04-30" });
    expect(s.cashCents).toBe(38000); // cash is all time
    expect(s.incomeCents).toBe(0); // nothing in April
    expect(s.expenseCents).toBe(0);
    expect(s.netCents).toBe(0);
  });
});
