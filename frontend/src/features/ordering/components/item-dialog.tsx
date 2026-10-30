import { CheckIcon, XIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { CountUp } from "@/components/motion/count-up.tsx"
import { Pressable } from "@/components/motion/pressable.tsx"
import { ProductImage } from "@/components/pos/product-image.tsx"
import { QtyStepper } from "@/components/pos/qty-stepper.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import type {
  ModifierGroup,
  Product,
} from "@/features/catalog/schemas/catalog.ts"
import type { DraftLine } from "@/features/ordering/schemas/order.ts"
import { formatIDR } from "@/lib/money.ts"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

type Choice = DraftLine["modifiers"][number]

function initialSelection(groups: ModifierGroup[], draft?: DraftLine) {
  const chosen = new Set(draft?.modifiers.map((m) => m.id) ?? [])
  return Object.fromEntries(
    groups.map((group) => [
      group.id,
      group.options.filter((o) => chosen.has(o.id)).map((o) => o.id),
    ])
  )
}

function Body({
  product,
  groups,
  guests,
  draft,
  onConfirm,
  onClose,
}: {
  product: Product
  groups: ModifierGroup[]
  guests: number
  draft?: DraftLine
  onConfirm: (line: Omit<DraftLine, "id" | "hold">) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<Record<string, string[]>>(() =>
    initialSelection(groups, draft)
  )
  const [note, setNote] = useState(draft?.note ?? "")
  const [seat, setSeat] = useState<number | null>(draft?.seat ?? null)
  const [quantity, setQuantity] = useState(draft?.quantity ?? 1)
  const [nudge, setNudge] = useState(0)
  const quickNotes = t("order.quickNotes", {
    returnObjects: true,
  }) as unknown as string[]

  const choices: Choice[] = groups.flatMap((group) =>
    group.options
      .filter((option) => selected[group.id]?.includes(option.id))
      .map((option) => ({
        id: option.id,
        group: group.name,
        name: option.name,
        price_delta: option.price_delta,
      }))
  )
  const missing = groups.filter(
    (group) => (selected[group.id]?.length ?? 0) < group.min_select
  )
  const unit =
    product.price + choices.reduce((sum, c) => sum + c.price_delta, 0)

  const toggle = (group: ModifierGroup, optionId: string) =>
    setSelected((current) => {
      const picked = current[group.id] ?? []
      if (picked.includes(optionId))
        return {
          ...current,
          [group.id]: picked.filter((id) => id !== optionId),
        }
      // Pick-one groups switch; pick-many groups stop at their maximum.
      if (group.max_select === 1) return { ...current, [group.id]: [optionId] }
      if (picked.length >= group.max_select) return current
      return { ...current, [group.id]: [...picked, optionId] }
    })

  const addNote = (text: string) =>
    setNote((current) =>
      current.toLowerCase().includes(text.toLowerCase())
        ? current
        : current
          ? `${current}, ${text}`
          : text
    )

  const confirm = () => {
    if (missing.length) {
      setNudge((n) => n + 1)
      document
        .getElementById(`group-${missing[0]!.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    onConfirm({
      product: product.id,
      name: product.name,
      image: product.image_url,
      unit_price: unit,
      quantity,
      modifiers: choices,
      note: note.trim(),
      seat,
    })
  }

  return (
    <div className="grid max-h-[88dvh] min-h-0 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
      <motion.div
        layoutId={`menu-photo-${product.id}`}
        transition={spring.sheet}
        className="relative overflow-hidden md:h-full"
      >
        <ProductImage
          src={product.image_url}
          alt={product.name}
          priority
          className="aspect-16/10 size-full md:aspect-auto"
        />
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-6 pt-16 text-white">
          <DialogPrimitive.Title className="font-heading text-2xl font-semibold">
            {product.name}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description
            className={cn(
              "mt-1 text-sm text-white/80",
              !product.description && "sr-only"
            )}
          >
            {product.description || product.name}
          </DialogPrimitive.Description>
        </div>
      </motion.div>

      <div className="flex min-h-0 flex-col">
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-6">
          {groups.map((group) => {
            const picked = selected[group.id] ?? []
            const needed = picked.length < group.min_select
            return (
              <section key={group.id} id={`group-${group.id}`}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="font-heading font-semibold">{group.name}</h3>
                  <span
                    key={needed ? nudge : "ok"}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      needed
                        ? "animate-shake bg-warning/15 text-warning-ink"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {group.min_select > 0
                      ? t("order.required")
                      : t("order.optional")}{" "}
                    ·{" "}
                    {group.max_select === 1
                      ? t("order.pickOne")
                      : t("order.pickUpTo", { count: group.max_select })}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.options.map((option) => {
                    const on = picked.includes(option.id)
                    return (
                      <Pressable
                        key={option.id}
                        role={group.max_select === 1 ? "radio" : "checkbox"}
                        aria-checked={on}
                        onClick={() => toggle(group, option.id)}
                        className={cn(
                          "flex h-12 items-center gap-2 rounded-2xl border px-4 text-sm font-medium transition-colors",
                          on
                            ? "border-primary bg-primary/10 text-accent-foreground"
                            : "bg-background"
                        )}
                      >
                        {on && <CheckIcon className="size-4" />}
                        {option.name}
                        {option.price_delta !== 0 && (
                          <span className="text-muted-foreground tabular-nums">
                            +{formatIDR(option.price_delta).replace("Rp ", "")}
                          </span>
                        )}
                      </Pressable>
                    )
                  })}
                </div>
              </section>
            )
          })}

          <section>
            <h3 className="mb-2 font-heading font-semibold">
              {t("order.note")}
            </h3>
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("order.notePlaceholder")}
              maxLength={200}
              className="h-12 rounded-xl text-base"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {quickNotes.map((text) => (
                <Pressable
                  key={text}
                  onClick={() => addNote(text)}
                  className="h-10 rounded-full bg-muted px-3.5 text-sm text-muted-foreground active:bg-accent"
                >
                  + {text}
                </Pressable>
              ))}
            </div>
          </section>

          {guests > 1 && (
            <section>
              <h3 className="mb-2 font-heading font-semibold">
                {t("order.seat")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {[null, ...Array.from({ length: guests }, (_, i) => i + 1)].map(
                  (value) => (
                    <Pressable
                      key={value ?? "shared"}
                      role="radio"
                      aria-checked={seat === value}
                      onClick={() => setSeat(value)}
                      className={cn(
                        "h-11 min-w-11 rounded-xl border px-3 text-sm font-medium tabular-nums transition-colors",
                        seat === value
                          ? "border-primary bg-primary/10 text-accent-foreground"
                          : "bg-background"
                      )}
                    >
                      {value ?? t("order.shared")}
                    </Pressable>
                  )
                )}
              </div>
            </section>
          )}
        </div>

        <div className="flex items-center gap-3 border-t bg-card/95 p-4 backdrop-blur">
          <QtyStepper
            value={quantity}
            min={1}
            onChange={setQuantity}
            labels={{ decrease: "−", increase: "+" }}
          />
          <Button size="xl" className="flex-1" onClick={confirm}>
            {draft ? t("common.save") : t("order.add")} ·{" "}
            <CountUp
              value={unit * quantity}
              format={formatIDR}
              className="tabular-nums"
            />
          </Button>
        </div>
      </div>

      <DialogPrimitive.Close asChild>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.cancel")}
          className="absolute top-4 left-4 grid size-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur outline-none focus-visible:ring-3 focus-visible:ring-white/60"
        >
          <XIcon className="size-5" />
        </button>
      </DialogPrimitive.Close>
    </div>
  )
}

/**
 * The item's choices, note, seat and quantity. Opens over the menu with the
 * card's photo growing into its hero image. `draft` edits a line instead.
 */
export function ItemDialog({
  product,
  groups,
  guests,
  draft,
  onConfirm,
  onClose,
}: {
  product: Product | null
  groups: ModifierGroup[]
  guests: number
  draft?: DraftLine
  onConfirm: (line: Omit<DraftLine, "id" | "hold">) => void
  onClose: () => void
}) {
  const productGroups = useMemo(
    () =>
      product
        ? groups.filter((group) => product.modifier_groups.includes(group.id))
        : [],
    [groups, product]
  )
  return (
    <DialogPrimitive.Root
      open={product !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <AnimatePresence>
        {product && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-40 bg-foreground/35 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                className="fixed inset-x-3 top-1/2 z-50 mx-auto max-w-4xl -translate-y-1/2 overflow-hidden rounded-3xl bg-card shadow-(--shadow-overlay) outline-none"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={spring.sheet}
              >
                <Body
                  key={product.id + (draft?.id ?? "")}
                  product={product}
                  groups={productGroups}
                  guests={guests}
                  draft={draft}
                  onConfirm={onConfirm}
                  onClose={onClose}
                />
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  )
}
