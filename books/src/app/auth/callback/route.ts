import { NextRequest, NextResponse } from "next/server";
import { getSupabaseEnv } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Where the email sign in link lands. It trades the one time code for a real
 * session, then sends you to the dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code && getSupabaseEnv().configured) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
