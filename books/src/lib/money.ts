/**
 * Money, done right.
 *
 * Every amount in OneDay Books is stored and computed as a whole number of
 * cents. We never store dollars as a floating point number, because 0.1 + 0.2
 * is not 0.3 in a computer and pennies go missing. All math in this file works
 * on integer cents and is covered by tests.
 *
 * $12.34  is stored as the integer  1234.
 * A credit (money out) is just a negative integer.
 */

/** A whole number of cents. Positive is money in, negative is money out. */
export type Cents = number;

function assertSafeInteger(value: number, label = "amount"): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be a whole number of cents, got ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} is too large to be exact: ${value}`);
  }
}

/**
 * Turn a number of dollars into cents, rounded to the nearest cent, half away
 * from zero. Use this for programmatic values. For anything a person typed,
 * use parseAmount instead.
 */
export function dollarsToCents(dollars: number): Cents {
  if (!Number.isFinite(dollars)) {
    throw new Error(`dollars must be a finite number, got ${dollars}`);
  }
  const sign = dollars < 0 ? -1 : 1;
  // The tiny nudge counters binary float drift such as 1.005 * 100 landing on
  // 100.49999999999999 instead of 100.5.
  return sign * Math.round(Math.abs(dollars) * 100 + 1e-6);
}

/** Turn cents into a dollars number. For display math only, never for storage. */
export function centsToDollars(cents: Cents): number {
  assertSafeInteger(cents, "cents");
  return cents / 100;
}

/**
 * Parse an amount a person typed into cents. Accepts things like:
 *   "12.34"  "$1,234.56"  "-5"  "(12.34)"  "  $0.9 "  "1234"
 * Accounting style parentheses mean a negative amount. More than two decimals
 * are rounded to the nearest cent, half up.
 */
export function parseAmount(input: string | number): Cents {
  if (typeof input === "number") {
    return dollarsToCents(input);
  }

  let s = input.trim();
  if (s === "") {
    throw new Error("Amount is empty");
  }

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1).trim();
  } else if (s.startsWith("+")) {
    s = s.slice(1).trim();
  }

  // Remove currency symbols, thousands separators, and spaces.
  s = s.replace(/[$,\s]/g, "");

  if (s === "" || s === "." || !/^\d*(\.\d+)?$/.test(s)) {
    throw new Error(`Cannot read this amount: ${JSON.stringify(input)}`);
  }

  const [whole, frac = ""] = s.split(".");
  const fracTwo = (frac + "00").slice(0, 2);
  let cents = Number(whole || "0") * 100 + Number(fracTwo || "0");

  // Round the extra precision beyond two decimals, half up.
  if (frac.length > 2 && Number(frac[2]) >= 5) {
    cents += 1;
  }

  const result = negative ? -cents : cents;
  assertSafeInteger(result, "parsed amount");
  return result;
}

/** Add any number of cent amounts. */
export function add(...amounts: Cents[]): Cents {
  let total = 0;
  for (const a of amounts) {
    assertSafeInteger(a, "cents");
    total += a;
  }
  assertSafeInteger(total, "sum");
  return total;
}

/** a minus b, in cents. */
export function subtract(a: Cents, b: Cents): Cents {
  assertSafeInteger(a, "cents");
  assertSafeInteger(b, "cents");
  const result = a - b;
  assertSafeInteger(result, "difference");
  return result;
}

/** Flip the sign of an amount. */
export function negate(cents: Cents): Cents {
  assertSafeInteger(cents, "cents");
  return -cents;
}

/** Sum a list of cent amounts. */
export function sum(amounts: Cents[]): Cents {
  return add(...amounts);
}

/** The absolute value of an amount, in cents. */
export function absCents(cents: Cents): Cents {
  assertSafeInteger(cents, "cents");
  return Math.abs(cents);
}

/**
 * Multiply an amount by a factor (for example a tax rate of 0.0765) and round
 * to the nearest cent, half away from zero. Returns whole cents.
 */
export function multiplyRound(cents: Cents, factor: number): Cents {
  assertSafeInteger(cents, "cents");
  if (!Number.isFinite(factor)) {
    throw new Error(`factor must be a finite number, got ${factor}`);
  }
  const product = cents * factor;
  const sign = product < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(product));
}

/**
 * A percent of an amount, rounded to the nearest cent. percentOf(10000, 25) is
 * 2500, which is 25 percent of $100.00. Handy for tax set aside amounts.
 */
export function percentOf(cents: Cents, percent: number): Cents {
  return multiplyRound(cents, percent / 100);
}

/**
 * Split an amount into parts by weight with not a single penny lost. The parts
 * always add back up to exactly the total. Leftover cents go to the parts with
 * the largest fractional remainder first, which is the fairest split.
 *
 *   allocate(1000, [1, 1, 1])  ->  [334, 333, 333]
 *   allocate(-1000, [1, 1, 1]) ->  [-334, -333, -333]
 */
export function allocate(total: Cents, weights: number[]): Cents[] {
  assertSafeInteger(total, "total");
  if (weights.length === 0) {
    throw new Error("allocate needs at least one weight");
  }
  if (weights.some((w) => !Number.isFinite(w) || w < 0)) {
    throw new Error("weights must be finite and not negative");
  }
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum === 0) {
    throw new Error("weights cannot all be zero");
  }

  const sign = total < 0 ? -1 : 1;
  const absTotal = Math.abs(total);

  const raw = weights.map((w) => (absTotal * w) / weightSum);
  const base = raw.map((r) => Math.floor(r));
  const allocated = base.reduce((a, b) => a + b, 0);
  let leftover = absTotal - allocated;

  const byRemainder = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);

  const result = base.slice();
  let k = 0;
  while (leftover > 0) {
    result[byRemainder[k % byRemainder.length].i] += 1;
    leftover -= 1;
    k += 1;
  }

  return result.map((v) => v * sign);
}

/** Split an amount into n equal parts with no penny lost. */
export function splitEvenly(total: Cents, parts: number): Cents[] {
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new Error(`parts must be a positive whole number, got ${parts}`);
  }
  return allocate(total, new Array(parts).fill(1));
}

/**
 * Format cents as US dollars for display, for example "$1,234.56".
 * Pass { cents: false } to show whole dollars rounded, for example "$1,235".
 */
export function formatUSD(
  cents: Cents,
  opts: { cents?: boolean } = {},
): string {
  assertSafeInteger(cents, "cents");
  const showCents = opts.cents !== false;
  const negative = cents < 0;
  const abs = Math.abs(cents);

  let body: string;
  if (showCents) {
    const whole = Math.floor(abs / 100);
    const rest = abs % 100;
    body = `$${whole.toLocaleString("en-US")}.${String(rest).padStart(2, "0")}`;
  } else {
    const whole = Math.round(abs / 100);
    body = `$${whole.toLocaleString("en-US")}`;
  }

  return negative ? `-${body}` : body;
}
