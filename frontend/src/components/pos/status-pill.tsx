import type { ReactNode } from "react"

import { cn } from "@/lib/utils.ts"

export type StatusTone =
  "neutral" | "success" | "warning" | "danger" | "accent" | "info"

const tones: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground [--dot:var(--muted-foreground)]",
  success: "bg-success/12 text-success-ink [--dot:var(--success)]",
  warning: "bg-warning/15 text-warning-ink [--dot:var(--warning)]",
  danger: "bg-danger/12 text-danger-ink [--dot:var(--danger)]",
  accent: "bg-primary/12 text-accent-foreground [--dot:var(--primary)]",
  info: "bg-chart-3/12 text-chart-3 [--dot:var(--chart-3)]",
}

/** A short status label with a coloured dot. Colour is never the only signal: the text says it too. */
export function StatusPill({
  tone = "neutral",
  pulse = false,
  className,
  children,
}: {
  tone?: StatusTone
  pulse?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors duration-300",
        tones[tone],
        className
      )}
    >
      <span className="relative flex size-1.5">
        {pulse && (
          <span className="absolute inset-0 animate-ping rounded-full bg-(--dot) opacity-60 motion-reduce:hidden" />
        )}
        <span className="relative size-1.5 rounded-full bg-(--dot)" />
      </span>
      {children}
    </span>
  )
}
