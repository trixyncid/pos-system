import type { ReactNode } from "react"

import { cn } from "@/lib/utils.ts"

export function RiseIn({
  delay = 0,
  className,
  children,
}: {
  delay?: number
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn("rise-in", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}
