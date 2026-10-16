"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/config";

/** The Supabase client for code running in the browser. */
export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    throw new Error("Supabase is not configured yet. See SETUP.md.");
  }
  return createBrowserClient(url, anonKey);
}
