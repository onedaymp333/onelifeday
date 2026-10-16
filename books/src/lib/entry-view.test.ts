import { describe, it, expect } from "vitest";
import { summarizeEntry, type RawEntry } from "./entry-view";

function entry(partial: Partial<RawEntry> & { journal_lines: RawEntry["journal_lines"] }): RawEntry {
  return {
    id: "e1",
    entry_date: "2026-03-03",
    memo: null,
    source: "manual",
    entity_id: "ent1",
    entities: { name: "Sound Society LLC" },
    ...partial,
  };
}

describe("summarizeEntry", () => {
  it("reads income as money in with the category and brand", () => {
    const view = summarizeEntry(
      entry({
        journal_lines: [
          {
            amount_cents: 50000,
            accounts: { name: "Checking", type: "asset", subtype: "bank" },
          },
          {
            amount_cents: -50000,
            brand_id: "b1",
            brands: { name: "OneDay Sounds" },
            accounts: { name: "Weddings", type: "income", subtype: null },
          },
        ],
      }),
    );
    expect(view.kind).toBe("income");
    expect(view.direction).toBe("in");
    expect(view.title).toBe("Weddings");
    expect(view.amountCents).toBe(50000);
    expect(view.brandName).toBe("OneDay Sounds");
    expect(view.subtitle).toBe("to Checking");
  });

  it("reads expense as money out from the paying account", () => {
    const view = summarizeEntry(
      entry({
        journal_lines: [
          {
            amount_cents: 12000,
            accounts: {
              name: "Software and subscriptions",
              type: "expense",
              subtype: null,
            },
          },
          {
            amount_cents: -12000,
            accounts: {
              name: "Credit card",
              type: "liability",
              subtype: "credit_card",
            },
          },
        ],
      }),
    );
    expect(view.kind).toBe("expense");
    expect(view.direction).toBe("out");
    expect(view.title).toBe("Software and subscriptions");
    expect(view.amountCents).toBe(12000);
    expect(view.subtitle).toBe("from Credit card");
  });

  it("reads a move between accounts as a transfer", () => {
    const view = summarizeEntry(
      entry({
        journal_lines: [
          {
            amount_cents: 20000,
            accounts: { name: "Savings", type: "asset", subtype: "bank" },
          },
          {
            amount_cents: -20000,
            accounts: { name: "Checking", type: "asset", subtype: "bank" },
          },
        ],
      }),
    );
    expect(view.kind).toBe("transfer");
    expect(view.direction).toBe("move");
    expect(view.title).toBe("Transfer");
    expect(view.amountCents).toBe(20000);
    expect(view.subtitle).toBe("Checking to Savings");
  });

  it("uses the memo as the subtitle when there is one", () => {
    const view = summarizeEntry(
      entry({
        memo: "Smith wedding deposit",
        journal_lines: [
          {
            amount_cents: 50000,
            accounts: { name: "Checking", type: "asset", subtype: "bank" },
          },
          {
            amount_cents: -50000,
            accounts: { name: "Weddings", type: "income", subtype: null },
          },
        ],
      }),
    );
    expect(view.subtitle).toBe("Smith wedding deposit");
  });
});
