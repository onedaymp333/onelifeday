/** Small date helpers. Dates are stored as plain YYYY-MM-DD strings. */

export interface MonthRange {
  from: string;
  to: string;
  label: string;
}

export function currentMonthRange(now = new Date()): MonthRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  const mm = String(m + 1).padStart(2, "0");
  const lastDay = new Date(y, m + 1, 0).getDate();
  return {
    from: `${y}-${mm}-01`,
    to: `${y}-${mm}-${String(lastDay).padStart(2, "0")}`,
    label: now.toLocaleString("en-US", { month: "long", year: "numeric" }),
  };
}

/** Turn 2026-03-03 into "Mar 3". */
export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
  });
}
