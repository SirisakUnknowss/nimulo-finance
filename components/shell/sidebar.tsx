"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-border lg:bg-card lg:shrink-0">
      <div className="flex h-16 items-center gap-2 px-6">
        <div className="h-7 w-7 rounded-lg bg-accent" aria-hidden />
        <span className="font-semibold tracking-tight">MONO Finance</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-accent-soft text-accent" : "text-muted-foreground hover:bg-accent-soft/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-4 text-xs text-muted-foreground">
        โหมดสาธิต · ข้อมูลจำลองในเบราว์เซอร์
      </div>
    </aside>
  );
}
