import { Trash2Icon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { MoneyText } from "@/components/pos/money-text.tsx"
import { TouchSheet } from "@/components/pos/touch-sheet.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { MoneyInput } from "@/components/ui/money-input.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import {
  useAllStockQuery,
  useReceive,
} from "@/features/inventory/api/inventory.ts"
import { ItemPicker } from "@/features/inventory/components/item-picker.tsx"
import { parseQuantity } from "@/features/inventory/lib/quantity.ts"
import type { StockItem } from "@/features/inventory/schemas/inventory.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { newId } from "@/lib/idempotency.ts"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

type Line = { item: StockItem; quantity: string; cost: string }

const unitLabel = (item: StockItem) =>
  item.unit === "portion" ? "porsi" : item.unit

function Body({
  preset,
  onDone,
}: {
  preset: StockItem | null
  onDone: () => void
}) {
  const { t } = useTranslation()
  const items = useAllStockQuery(true)
  const receive = useReceive()
  const delivery = useRef(newId())
  const [supplier, setSupplier] = useState("")
  const [note, setNote] = useState("")
  const [lines, setLines] = useState<Line[]>(
    preset ? [{ item: preset, quantity: "", cost: String(preset.cost) }] : []
  )

  const parsed = lines.map((line) => ({
    ...line,
    qty: parseQuantity(line.quantity),
    unitCost: Number(line.cost || 0),
  }))
  const valid = parsed.length > 0 && parsed.every((line) => line.qty > 0)
  const total = parsed.reduce(
    (sum, line) =>
      sum + (line.qty > 0 ? Math.round(line.qty * line.unitCost) : 0),
    0
  )

  const update = (id: string, patch: Partial<Line>) =>
    setLines((all) =>
      all.map((line) => (line.item.id === id ? { ...line, ...patch } : line))
    )

  const submit = async () => {
    try {
      await receive.mutateAsync({
        id: delivery.current,
        supplier,
        note,
        lines: parsed.map((line) => ({
          product: line.item.id,
          quantity: line.qty,
          unit_cost: line.unitCost,
        })),
      })
      toast.success(t("inventory.received", { count: lines.length }))
      onDone()
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Input
          value={supplier}
          onChange={(event) => setSupplier(event.target.value)}
          maxLength={60}
          placeholder={t("inventory.supplier")}
          aria-label={t("inventory.supplier")}
          className="h-12 rounded-xl text-base"
        />
        <Input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={60}
          placeholder={t("inventory.invoice")}
          aria-label={t("inventory.invoice")}
          className="h-12 rounded-xl text-base"
        />
      </div>

      <ItemPicker
        items={items.data ?? []}
        exclude={new Set(lines.map((line) => line.item.id))}
        onPick={(item) =>
          setLines((all) => [
            ...all,
            { item, quantity: "", cost: String(item.cost) },
          ])
        }
      />

      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {parsed.map((line) => (
            <motion.li
              key={line.item.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={spring.layout}
              className="space-y-2 rounded-2xl bg-background p-3"
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-medium">
                  {line.item.name}
                </span>
                <button
                  type="button"
                  aria-label={t("inventory.removeLine", {
                    name: line.item.name,
                  })}
                  onClick={() =>
                    setLines((all) =>
                      all.filter((other) => other.item.id !== line.item.id)
                    )
                  }
                  className="grid size-9 place-items-center rounded-lg text-muted-foreground active:bg-muted"
                >
                  <Trash2Icon className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                <div className="relative">
                  <Input
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={(event) =>
                      update(line.item.id, { quantity: event.target.value })
                    }
                    placeholder="0"
                    aria-label={t("inventory.quantity")}
                    aria-invalid={line.quantity !== "" && !(line.qty > 0)}
                    className="h-11 rounded-xl pr-14 text-base tabular-nums"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                    {unitLabel(line.item)}
                  </span>
                </div>
                <MoneyInput
                  value={line.cost}
                  onChange={(cost) => update(line.item.id, { cost })}
                  className="h-11 rounded-xl"
                />
                <MoneyText
                  amount={
                    line.qty > 0 ? Math.round(line.qty * line.unitCost) : 0
                  }
                  className={cn(
                    "w-28 text-right font-medium",
                    !(line.qty > 0) && "text-muted-foreground"
                  )}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("inventory.costPer", { unit: unitLabel(line.item) })}
              </p>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3">
        <span className="text-sm text-muted-foreground">
          {t("inventory.deliveryTotal")}
        </span>
        <MoneyText
          amount={total}
          animate
          className="font-heading text-2xl font-semibold"
        />
      </div>
      <Button
        size="xl"
        className="w-full"
        disabled={!valid || receive.isPending}
        onClick={() => void submit()}
      >
        {receive.isPending && <Spinner />}
        {t("inventory.saveReceive", { count: lines.length })}
      </Button>
    </div>
  )
}

/** A delivery: what arrived, how much, and what it cost (which moves each item's average cost). */
export function ReceiveSheet({
  open,
  preset,
  onClose,
}: {
  open: boolean
  preset: StockItem | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <TouchSheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      side="right"
      title={t("inventory.receiveTitle")}
      description={t("inventory.receiveBody")}
      className="w-[min(600px,calc(100vw-1rem))]"
    >
      {open && <Body preset={preset} onDone={onClose} />}
    </TouchSheet>
  )
}
