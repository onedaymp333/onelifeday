/**
 * Reads the environment settings the app needs. The app is built to run even
 * before you have added your keys: when Supabase is not configured yet, the
 * screens show friendly setup steps instead of crashing.
 */

export interface SupabaseEnv {
  url: string | undefined;
  anonKey: string | undefined;
  configured: boolean;
}

export function getSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url, anonKey, configured: Boolean(url && anonKey) };
}

/** The AI help switch. Off by default, so the app stays free until you turn it on. */
export function isAiEnabled(): boolean {
  return (
    process.env.AI_ENABLED === "true" && Boolean(process.env.ANTHROPIC_API_KEY)
  );
}
