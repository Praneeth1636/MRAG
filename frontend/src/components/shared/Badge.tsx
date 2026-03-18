import type React from "react";
import { cn } from "@/lib/utils";

const variants = {
  default: "bg-surface-2 text-[var(--text-muted)] border-transparent",
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  danger: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  info: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

export function Badge({
  variant = "default",
  children,
  className,
}: {
  variant?: keyof typeof variants;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono font-medium",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

