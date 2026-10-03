"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

const DRAG_THRESHOLD_PX = 6;

/**
 * iOS 26 style floating tab bar: a glass "lens" sits under the active tab,
 * lifts when pressed, follows the finger while dragging and settles (with a
 * little spring) on the nearest tab on release.
 */
export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const items = NAV_ITEMS.slice(0, 5);
  const count = items.length;

  const trackRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; id: number } | null>(null);
  const suppressClick = useRef(false);

  const [pressed, setPressed] = useState(false);
  const [dragX, setDragX] = useState<number | null>(null); // lens left edge in px within the track
  const [preview, setPreview] = useState<number | null>(null);

  const activeIndex = Math.max(0, items.findIndex((i) => pathname.startsWith(i.href)));
  const shownIndex = preview ?? activeIndex;

  function track() {
    const rect = trackRef.current!.getBoundingClientRect();
    return { left: rect.left, width: rect.width, item: rect.width / count };
  }

  function indexAt(clientX: number) {
    const t = track();
    return Math.min(count - 1, Math.max(0, Math.floor((clientX - t.left) / t.item)));
  }

  function onPointerDown(e: React.PointerEvent) {
    start.current = { x: e.clientX, id: e.pointerId };
    setPressed(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return;
    if (dragX === null && Math.abs(e.clientX - start.current.x) < DRAG_THRESHOLD_PX) return;
    if (dragX === null) trackRef.current?.setPointerCapture(start.current.id);
    const t = track();
    const left = Math.min(t.width - t.item, Math.max(0, e.clientX - t.left - t.item / 2));
    setDragX(left);
    setPreview(indexAt(e.clientX));
  }

  function onPointerEnd(e: React.PointerEvent) {
    if (!start.current) return;
    const dragged = dragX !== null;
    start.current = null;
    setPressed(false);
    setDragX(null);
    setPreview(null);
    if (dragged) {
      suppressClick.current = true;
      const target = items[indexAt(e.clientX)];
      if (e.type === "pointerup" && target && !pathname.startsWith(target.href)) router.push(target.href);
    }
  }

  const lensTransform =
    dragX !== null ? `translateX(${dragX}px)` : `translateX(${activeIndex * 100}%)`;
  // Counter-translation for the magnified copy of the tabs inside the lens,
  // so the copy stays aligned with the real tabs underneath it.
  const cloneTransform =
    dragX !== null ? `translateX(${-dragX}px)` : `translateX(${(-activeIndex * 100) / count}%)`;
  const glide =
    dragX === null
      ? "transition-transform duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)] motion-reduce:transition-none"
      : "";

  return (
    <nav
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 touch-none select-none p-1.5 lg:hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClickCapture={(e) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      {/* Bar surface is its own layer so the lens (a sibling, not a child)
          can blur the page behind it independently. */}
      <div aria-hidden className="glass-strong absolute inset-0 rounded-full" />
      <div ref={trackRef} className="relative flex">
        {items.map((item, i) => {
          const Icon = item.icon;
          const underLens = pressed && i === shownIndex;
          return (
            <Link
              key={item.href}
              href={item.href}
              draggable={false}
              className={cn(
                "relative z-10 flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-[color,opacity] duration-200",
                i === shownIndex ? "text-accent" : "text-muted-foreground",
                underLens && "opacity-0",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}

        <div
          aria-hidden
          className={cn("pointer-events-none absolute inset-y-0 left-0 z-20", glide)}
          style={{ width: `${100 / count}%`, transform: lensTransform }}
        >
          <div
            className={cn(
              "glass-lens relative h-full w-full overflow-hidden rounded-full transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)]",
              pressed && "glass-lens-pressed scale-[1.3]",
            )}
          >
            {/* Magnified copy of the tabs, clipped to the lens. */}
            <div
              className={cn("absolute inset-y-0 left-0 flex text-accent", glide)}
              style={{ width: `${count * 100}%`, transform: cloneTransform }}
            >
              {items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={item.href} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium">
                    <Icon className={cn("h-5 w-5", i !== shownIndex && "opacity-70")} />
                    {item.label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
