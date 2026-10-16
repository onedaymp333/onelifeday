"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-xl bg-ink-soft p-5 text-center">
        <p className="text-lg font-medium">Check your email</p>
        <p className="mt-2 text-sm text-white/60">
          I sent a sign in link to {email}. Open it on this device to come
          straight in. The link works once and expires shortly.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-4 text-sm text-brand-soft underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="text-sm text-white/70">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2.5 text-white outline-none focus:border-brand"
        />
      </div>

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium transition hover:bg-brand-soft disabled:opacity-60"
      >
        {status === "sending" ? "Sending the link" : "Email me a sign in link"}
      </button>

      {status === "error" && (
        <p className="text-sm text-money-out">{message}</p>
      )}

      <p className="text-center text-xs text-white/40">
        No password to remember. Face ID and passkeys come in a later update.
      </p>
    </form>
  );
}
