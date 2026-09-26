import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isSupabaseConfigured } from "./config";

/**
 * Server-side Supabase client for use in Server Components / Route
 * Handlers / Server Actions. Returns null when Supabase is not
 * configured, so callers must fall back to demo mode.
 */
export async function createSupabaseServerClient() {
  if (!isSupabaseConfigured()) return null;
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
            // Called from a Server Component without mutation permission;
            // safe to ignore when middleware also refreshes the session.
          }
        },
      },
    },
  );
}
