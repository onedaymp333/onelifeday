import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/config";

/**
 * The Supabase client for server code (Server Components, Route Handlers,
 * Server Actions). It reads and writes the session cookies so your login
 * follows you across the app.
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    throw new Error("Supabase is not configured yet. See SETUP.md.");
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component where cookies are read only. The
          // middleware refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}
