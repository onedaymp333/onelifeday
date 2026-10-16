import { describe, it, expect } from "vitest";
import {
  dollarsToCents,
  centsToDollars,
  parseAmount,
  add,
  subtract,
  negate,
  sum,
  absCents,
  multiplyRound,
  percentOf,
  allocate,
  splitEvenly,
  formatUSD,
} from "./money";

describe("dollarsToCents", () => {
  it("converts simple values", () => {
    expect(dollarsToCents(0)).toBe(0);
    expect(dollarsToCents(1)).toBe(100);
    expect(dollarsToCents(12.34)).toBe(1234);
    expect(dollarsToCents(-5)).toBe(-500);
  });

  it("is safe against binary float drift", () => {
    expect(dollarsToCents(1.005)).toBe(101);
    expect(dollarsToCents(0.1)).toBe(10);
    expect(dollarsToCents(0.2)).toBe(20);
    expect(dollarsToCents(29.99)).toBe(2999);
  });

  it("rejects non finite numbers", () => {
    expect(() => dollarsToCents(Infinity)).toThrow();
    expect(() => dollarsToCents(NaN)).toThrow();
  });
});

describe("centsToDollars", () => {
  it("round trips through dollarsToCents", () => {
    expect(centsToDollars(1234)).toBe(12.34);
    expect(centsToDollars(0)).toBe(0);
  });
});

describe("parseAmount", () => {
  it("parses plain numbers and decimals", () => {
    expect(parseAmount("0")).toBe(0);
    expect(parseAmount("5")).toBe(500);
    expect(parseAmount("12.34")).toBe(1234);
    expect(parseAmount("0.9")).toBe(90);
    expect(parseAmount("1234")).toBe(123400);
  });

  it("handles currency symbols, commas, and spaces", () => {
    expect(parseAmount("$1,234.56")).toBe(123456);
    expect(parseAmount("  $0.99 ")).toBe(99);
    expect(parseAmount("$1,000")).toBe(100000);
  });

  it("treats accounting parentheses as negative", () => {
    expect(parseAmount("(12.34)")).toBe(-1234);
    expect(parseAmount("($1,000.00)")).toBe(-100000);
  });

  it("handles explicit signs", () => {
    expect(parseAmount("-5")).toBe(-500);
    expect(parseAmount("+5")).toBe(500);
  });

  it("rounds more than two decimals to the nearest cent, half up", () => {
    expect(parseAmount("1.005")).toBe(101);
    expect(parseAmount("1.004")).toBe(100);
    expect(parseAmount("9.999")).toBe(1000);
  });

  it("accepts numbers directly", () => {
    expect(parseAmount(12.34)).toBe(1234);
  });

  it("rejects junk", () => {
    expect(() => parseAmount("")).toThrow();
    expect(() => parseAmount("abc")).toThrow();
    expect(() => parseAmount("1.2.3")).toThrow();
    expect(() => parseAmount(".")).toThrow();
  });
});

describe("add, subtract, negate, sum", () => {
  it("adds without float error", () => {
    // The classic 0.1 + 0.2 trap, done in cents.
    expect(add(parseAmount("0.1"), parseAmount("0.2"))).toBe(30);
    expect(formatUSD(add(10, 20))).toBe("$0.30");
  });

  it("adds many amounts", () => {
    expect(add(100, 200, 300, -50)).toBe(550);
    expect(sum([100, 200, 300, -50])).toBe(550);
  });

  it("subtracts and negates", () => {
    expect(subtract(1000, 250)).toBe(750);
    expect(negate(750)).toBe(-750);
    expect(absCents(-750)).toBe(750);
  });

  it("rejects non integer cents", () => {
    expect(() => add(10.5, 1)).toThrow();
  });
});

describe("multiplyRound and percentOf", () => {
  it("applies a tax rate and rounds to the cent", () => {
    // 7.65 percent self employment style rate on $100.00
    expect(multiplyRound(10000, 0.0765)).toBe(765);
    expect(multiplyRound(12345, 0.0765)).toBe(944);
  });

  it("rounds half away from zero", () => {
    expect(multiplyRound(101, 0.5)).toBe(51);
    expect(multiplyRound(-101, 0.5)).toBe(-51);
  });

  it("computes a percent for tax set aside", () => {
    expect(percentOf(10000, 25)).toBe(2500);
    expect(percentOf(150000, 30)).toBe(45000);
  });
});

describe("allocate and splitEvenly", () => {
  it("never loses a penny", () => {
    expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    expect(allocate(1000, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it("splits by weight", () => {
    expect(allocate(10000, [1, 3])).toEqual([2500, 7500]);
    const parts = allocate(10000, [1, 1, 1, 1, 1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it("handles negative totals", () => {
    expect(allocate(-1000, [1, 1, 1])).toEqual([-334, -333, -333]);
    expect(allocate(-1000, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(-1000);
  });

  it("splits evenly with no penny lost", () => {
    expect(splitEvenly(100, 3)).toEqual([34, 33, 33]);
    expect(splitEvenly(100, 3).reduce((a, b) => a + b, 0)).toBe(100);
    // A deposit split across 12 monthly chunks.
    const twelve = splitEvenly(10000, 12);
    expect(twelve.reduce((a, b) => a + b, 0)).toBe(10000);
    expect(twelve.length).toBe(12);
  });

  it("rejects bad input", () => {
    expect(() => allocate(100, [])).toThrow();
    expect(() => allocate(100, [0, 0])).toThrow();
    expect(() => allocate(100, [-1, 2])).toThrow();
    expect(() => splitEvenly(100, 0)).toThrow();
  });
});

describe("formatUSD", () => {
  it("formats with cents by default", () => {
    expect(formatUSD(0)).toBe("$0.00");
    expect(formatUSD(1234)).toBe("$12.34");
    expect(formatUSD(123456)).toBe("$1,234.56");
    expect(formatUSD(-5000)).toBe("-$50.00");
    expect(formatUSD(5)).toBe("$0.05");
  });

  it("can show whole dollars rounded", () => {
    expect(formatUSD(123456, { cents: false })).toBe("$1,235");
    expect(formatUSD(149, { cents: false })).toBe("$1");
    expect(formatUSD(150, { cents: false })).toBe("$2");
  });
});
