"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setupBooks } from "./actions";

export default function SetupBooks() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function run() {
    setError("");
    startTransition(async () => {
      const result = await setupBooks();
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong. Try again.");
      }
    });
  }

  return (
    <div className="rounded-2xl bg-ink-soft p-6">
      <h2 className="text-lg font-semibold">Set up your books</h2>
      <p className="mt-2 text-sm text-white/60">
        This creates your two sets of books, the brands inside Sound Society
        LLC, and your full chart of accounts mapped to the tax lines. One tap.
      </p>
      <ul className="mt-4 space-y-1 text-sm text-white/70">
        <li>Sound Society LLC with OneDay Sounds, Ctrl.Booth, Loud Garden</li>
        <li>Personal, kept separate</li>
      </ul>
      <button
        onClick={run}
        disabled={pending}
        className="mt-5 rounded-lg bg-brand px-4 py-2.5 font-medium transition hover:bg-brand-soft disabled:opacity-60"
      >
        {pending ? "Setting up" : "Set up my books"}
      </button>
      {error && <p className="mt-3 text-sm text-money-out">{error}</p>}
    </div>
  );
}
