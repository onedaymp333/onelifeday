import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/config";

/**
 * Keeps your login fresh on every request by refreshing the session cookies.
 * If Supabase is not configured yet, this quietly does nothing.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url, anonKey, configured } = getSupabaseEnv();
  if (!configured || !url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Touch the user to trigger a token refresh when needed.
  await supabase.auth.getUser();

  return response;
}
