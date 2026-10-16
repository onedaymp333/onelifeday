"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await createSupabaseBrowserClient().auth.signOut();
      router.replace("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={signOut}
      disabled={busy}
      className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/5 disabled:opacity-50"
    >
      {busy ? "Signing out" : "Sign out"}
    </button>
  );
}
