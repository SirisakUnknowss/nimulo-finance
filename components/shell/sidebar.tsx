"use client";

import Link from "next/link";
import { assetPath } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Coffee } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col glass lg:shrink-0 lg:rounded-none lg:border-y-0 lg:border-l-0">
      <div className="flex h-16 items-center gap-2 px-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG, no next/image optimization needed */}
        <img src={assetPath("/brand/nimulo-symbol.svg")} alt="" className="h-6 w-6" aria-hidden />
        <span className="font-semibold tracking-tight lowercase">
          nimulo
        </span>
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
      <div className="space-y-3 border-t border-border p-4 text-xs text-muted-foreground">
        <Link
          href="/support"
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 font-medium transition-colors",
            pathname.startsWith("/support") ? "bg-accent-soft text-accent" : "hover:bg-accent-soft/60 hover:text-foreground",
          )}
        >
          <Coffee className="h-4 w-4" />
          เลี้ยงกาแฟ dev
        </Link>
        <p>ข้อมูลเก็บในเบราว์เซอร์นี้เท่านั้น</p>
      </div>
    </aside>
  );
}
