import { redirect } from "next/navigation";
import { getSupabaseEnv } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import NotConfigured from "@/components/NotConfigured";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!getSupabaseEnv().configured) {
    return <NotConfigured />;
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-8 px-4 py-12">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-brand-soft">
          OneDay Books
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Welcome back</h1>
        <p className="mt-2 text-sm text-white/60">
          Your books, synced across every device.
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
