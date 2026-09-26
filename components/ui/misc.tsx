import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "success" | "warning" | "danger" | "transfer" | "outline" }) {
  const styles: Record<string, string> = {
    default: "bg-accent-soft text-accent",
    success: "bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] text-danger",
    transfer: "bg-[color-mix(in_srgb,var(--transfer)_15%,transparent)] text-transfer",
    outline: "border border-border text-muted-foreground",
  };
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", styles[variant], className)}
      {...props}
    />
  );
}

export function Progress({ value, className, indicatorClassName }: { value: number; className?: string; indicatorClassName?: string }) {
  const clamped = Math.min(Math.max(value, 0), 100);
  return (
    <ProgressPrimitive.Root className={cn("h-2 w-full overflow-hidden rounded-full bg-accent-soft", className)}>
      <ProgressPrimitive.Indicator
        className={cn("h-full bg-accent transition-all", indicatorClassName)}
        style={{ width: `${clamped}%` }}
      />
    </ProgressPrimitive.Root>
  );
}

export const Tabs = TabsPrimitive.Root;
export const TabsList = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) => (
  <TabsPrimitive.List className={cn("inline-flex gap-1 rounded-lg border border-border bg-card p-1", className)} {...props} />
);
export const TabsTrigger = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) => (
  <TabsPrimitive.Trigger
    className={cn(
      "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground data-[state=active]:bg-accent-soft data-[state=active]:text-accent transition-colors",
      className,
    )}
    {...props}
  />
);
export const TabsContent = TabsPrimitive.Content;

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-14 text-center px-6">
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-sm text-muted-foreground max-w-sm">{description}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-accent-soft", className)} />;
}
