"use client";

import { usePathname } from "next/navigation";
import { assetPath } from "@/lib/utils";
import { Moon, Sun, Monitor, User, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { NAV_ITEMS } from "./nav-items";
import { QuickAddTransactionDialog } from "@/components/transactions/quick-add-dialog";
import { useState } from "react";

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const current = NAV_ITEMS.find((i) => pathname.startsWith(i.href));

  function cycleTheme() {
    setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");
  }

  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur lg:px-8">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG, no next/image optimization needed */}
        <img src={assetPath("/brand/nimulo-symbol.svg")} alt="" className="h-5 w-5 lg:hidden" aria-hidden />
        <h1 className="text-base font-semibold">{current?.label ?? "nimulo."}</h1>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => setQuickAddOpen(true)}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">เพิ่มรายการ</span>
        </Button>
        <Button size="icon" variant="outline" onClick={cycleTheme} aria-label="สลับธีม">
          <ThemeIcon className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="outline" aria-label="บัญชีผู้ใช้">
          <User className="h-4 w-4" />
        </Button>
      </div>
      <QuickAddTransactionDialog open={quickAddOpen} onOpenChange={setQuickAddOpen} />
    </header>
  );
}
