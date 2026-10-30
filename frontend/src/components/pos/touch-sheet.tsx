import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Drawer } from "vaul"

import { cn } from "@/lib/utils.ts"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  /**
   * `center`: a modal in the middle of the screen, for every form and
   * create/edit flow. `bottom`: a sheet dragged up from the bottom, for
   * quick one-tap actions (guest count, table choice).
   */
  side?: "bottom" | "center"
  children: ReactNode
  footer?: ReactNode
  className?: string
}

function Header({
  title,
  description,
  Title,
  Description,
}: {
  title: ReactNode
  description?: ReactNode
  Title: typeof DialogPrimitive.Title
  Description: typeof DialogPrimitive.Description
}) {
  return (
    <div className="px-6 pt-5 pb-3">
      <Title className="pr-10 font-heading text-xl font-semibold">
        {title}
      </Title>
      {description ? (
        <Description className="mt-1 text-sm text-muted-foreground">
          {description}
        </Description>
      ) : (
        <Description className="sr-only">{title}</Description>
      )}
    </div>
  )
}

function Body({
  children,
  footer,
}: {
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
        {children}
      </div>
      {footer && (
        <div className="border-t bg-card/80 px-6 py-4 backdrop-blur">
          {footer}
        </div>
      )}
    </>
  )
}

/** A centred modal for forms, or a bottom sheet for quick actions. */
export function TouchSheet({
  open,
  onOpenChange,
  title,
  description,
  side = "bottom",
  children,
  footer,
  className,
}: Props) {
  const { t } = useTranslation()

  if (side === "center")
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <DialogPrimitive.Content
            className={cn(
              "fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-3xl bg-card shadow-(--shadow-overlay) outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              className
            )}
          >
            <Header
              title={title}
              description={description}
              Title={DialogPrimitive.Title}
              Description={DialogPrimitive.Description}
            />
            <DialogPrimitive.Close
              aria-label={t("common.close")}
              className="absolute top-4 right-4 grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <XIcon className="size-5" />
            </DialogPrimitive.Close>
            <Body footer={footer}>{children}</Body>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    )

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} direction="bottom">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-[2px]" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] max-w-3xl flex-col rounded-t-3xl bg-card pb-safe shadow-(--shadow-overlay) outline-none",
            className
          )}
        >
          <div
            aria-hidden
            className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-border"
          />
          <Header
            title={title}
            description={description}
            Title={Drawer.Title}
            Description={Drawer.Description}
          />
          <Body footer={footer}>{children}</Body>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
