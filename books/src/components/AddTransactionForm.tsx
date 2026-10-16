"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseAmount } from "@/lib/money";
import { TXN_TYPES, type TxnType } from "@/lib/ledger";
import type { AccountLite, EntityWithAccounts } from "@/lib/types";
import { addTransaction } from "@/app/transactions/actions";

const MONEY_SUBTYPES = ["bank", "cash", "credit_card"];

const INPUT =
  "w-full rounded-lg border border-white/15 bg-ink px-3 py-2.5 text-white outline-none focus:border-brand";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default function AddTransactionForm({
  entities,
}: {
  entities: EntityWithAccounts[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [entityId, setEntityId] = useState(entities[0]?.id ?? "");
  const [type, setType] = useState<TxnType>("income");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(todayIso());
  const [categoryAccountId, setCategoryAccountId] = useState("");
  const [moneyAccountId, setMoneyAccountId] = useState("");
  const [secondMoneyAccountId, setSecondMoneyAccountId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");

  const entity = useMemo(
    () => entities.find((e) => e.id === entityId),
    [entities, entityId],
  );

  const moneyAccounts = useMemo(
    () =>
      (entity?.accounts ?? []).filter((a) =>
        MONEY_SUBTYPES.includes(a.subtype ?? ""),
      ),
    [entity],
  );
  const categoryAccounts = useMemo(
    () =>
      (entity?.accounts ?? []).filter((a) =>
        type === "income" ? a.type === "income" : a.type === "expense",
      ),
    [entity, type],
  );
  const ownerDraws = entity?.accounts.find((a) => a.subtype === "owner_draw");
  const ownerContrib = entity?.accounts.find(
    (a) => a.subtype === "owner_contribution",
  );

  // Keep the money account valid when the entity changes.
  useEffect(() => {
    setMoneyAccountId(moneyAccounts[0]?.id ?? "");
    setSecondMoneyAccountId(moneyAccounts[1]?.id ?? moneyAccounts[0]?.id ?? "");
    setBrandId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  // Keep the category valid when the type or entity changes.
  useEffect(() => {
    setCategoryAccountId(categoryAccounts[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, entityId]);

  const needsCategory = type === "income" || type === "expense";
  const needsBrand = (type === "income" || type === "expense") && !entity?.is_personal;
  const moneyLabel =
    type === "income"
      ? "Deposit to"
      : type === "expense"
        ? "Paid from"
        : type === "transfer"
          ? "From"
          : type === "owner_draw"
            ? "From"
            : "To";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    let amountCents: number;
    try {
      amountCents = parseAmount(amount);
    } catch {
      setError("Enter an amount like 250 or 1,250.50");
      return;
    }
    if (amountCents <= 0) {
      setError("Amount must be more than zero.");
      return;
    }

    startTransition(async () => {
      const result = await addTransaction({
        entityId,
        type,
        amountCents,
        entryDate,
        categoryAccountId: needsCategory ? categoryAccountId : undefined,
        moneyAccountId,
        secondMoneyAccountId: type === "transfer" ? secondMoneyAccountId : undefined,
        ownerAccountId:
          type === "owner_draw"
            ? ownerDraws?.id
            : type === "owner_in"
              ? ownerContrib?.id
              : undefined,
        brandId: needsBrand && brandId ? brandId : null,
        memo: memo.trim() || undefined,
      });

      if (result.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong. Try again.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {entities.length > 1 && (
        <Field label="Books">
          <select
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className={INPUT}
          >
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="What happened">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(TXN_TYPES) as TxnType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-lg px-3 py-2 text-sm transition ${
                type === t
                  ? "bg-brand text-white"
                  : "bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              {TXN_TYPES[t].label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-white/40">{TXN_TYPES[type].help}</p>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
              $
            </span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className={`${INPUT} pl-7`}
            />
          </div>
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className={INPUT}
          />
        </Field>
      </div>

      {needsCategory && (
        <Field label={type === "income" ? "Income category" : "Expense category"}>
          <AccountSelect
            accounts={categoryAccounts}
            value={categoryAccountId}
            onChange={setCategoryAccountId}
          />
        </Field>
      )}

      <Field label={moneyLabel}>
        <AccountSelect
          accounts={moneyAccounts}
          value={moneyAccountId}
          onChange={setMoneyAccountId}
        />
      </Field>

      {type === "transfer" && (
        <Field label="To">
          <AccountSelect
            accounts={moneyAccounts}
            value={secondMoneyAccountId}
            onChange={setSecondMoneyAccountId}
          />
        </Field>
      )}

      {needsBrand && entity && entity.brands.length > 0 && (
        <Field label="Brand (optional)">
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className={INPUT}
          >
            <option value="">No brand</option>
            {entity.brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Note (optional)">
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="Smith wedding deposit"
          className={INPUT}
        />
      </Field>

      {error && <p className="text-sm text-money-out">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-brand px-4 py-2.5 font-medium transition hover:bg-brand-soft disabled:opacity-60"
        >
          {pending ? "Saving" : "Save transaction"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-white/15 px-4 py-2.5 text-white/70 transition hover:bg-white/5"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm text-white/70">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function AccountSelect({
  accounts,
  value,
  onChange,
}: {
  accounts: AccountLite[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={INPUT}
    >
      {accounts.length === 0 && <option value="">No accounts</option>}
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );
}
