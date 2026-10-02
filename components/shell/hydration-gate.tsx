"use client";

import { useDemoStore } from "@/lib/demo/store";

/**
 * Pages are prerendered at build time, but demo data is date-relative, so the
 * first client render would differ from the static HTML (React #418). Render
 * page content only after the store has hydrated on the client.
 */
export function HydrationGate({ children }: { children: React.ReactNode }) {
  const { hydrated } = useDemoStore();
  return hydrated ? <>{children}</> : null;
}
