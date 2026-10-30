import type { ReactNode } from "react"
import { Drawer } from "vaul"

import { cn } from "@/lib/utils.ts"

/**
 * A sheet that slides over the screen and can be dragged away, used on POS
 * screens instead of small centred dialogs. `side="right"` suits wide forms
 * in landscape; `bottom` suits quick actions.
 */
export function TouchSheet({
  open,
  onOpenChange,
  title,
  description,
  side = "bottom",
  children,
  footer,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  side?: "bottom" | "right"
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} direction={side}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-[2px]" />
        <Drawer.Content
          className={cn(
            "fixed z-50 flex flex-col bg-card shadow-(--shadow-overlay) outline-none",
            side === "bottom" &&
              "inset-x-0 bottom-0 mx-auto max-h-[88dvh] max-w-3xl rounded-t-3xl pb-safe",
            side === "right" &&
              "inset-y-2 right-2 w-[min(520px,calc(100vw-1rem))] rounded-3xl",
            className
          )}
        >
          {side === "bottom" && (
            <div
              aria-hidden
              className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-border"
            />
          )}
          <div className="px-6 pt-5 pb-3">
            <Drawer.Title className="font-heading text-xl font-semibold">
              {title}
            </Drawer.Title>
            {description ? (
              <Drawer.Description className="mt-1 text-sm text-muted-foreground">
                {description}
              </Drawer.Description>
            ) : (
              <Drawer.Description className="sr-only">
                {title}
              </Drawer.Description>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
            {children}
          </div>
          {footer && (
            <div className="border-t bg-card/80 px-6 py-4 backdrop-blur">
              {footer}
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
