import { formatUSD } from "@/lib/money";
import { formatShortDate } from "@/lib/dates";
import type { EntryView } from "@/lib/entry-view";

export default function TransactionRow({
  entry,
  showEntity = false,
}: {
  entry: EntryView;
  showEntity?: boolean;
}) {
  const color =
    entry.direction === "in"
      ? "text-money-in"
      : entry.direction === "out"
        ? "text-money-out"
        : "text-white/50";
  const sign =
    entry.direction === "in" ? "+" : entry.direction === "out" ? "-" : "";

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{entry.title}</p>
        <p className="truncate text-xs text-white/45">
          {formatShortDate(entry.date)}
          {entry.subtitle ? ` · ${entry.subtitle}` : ""}
          {showEntity && entry.entityName ? ` · ${entry.entityName}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {entry.brandName && (
          <span className="hidden rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/70 sm:inline">
            {entry.brandName}
          </span>
        )}
        <span className={`shrink-0 font-semibold ${color}`}>
          {sign}
          {formatUSD(entry.amountCents)}
        </span>
      </div>
    </div>
  );
}
