"use client";

import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured } from "./config";

/**
 * Returns a browser Supabase client, or null when env vars are not
 * configured (in which case the app falls back to demo mode). Callers
 * must always null-check the result.
 */
export function createSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) return null;
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
