import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Pressable } from "@/components/motion/pressable.tsx"
import { QtyStepper } from "@/components/pos/qty-stepper.tsx"
import { TouchSheet } from "@/components/pos/touch-sheet.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import type { FloorTable } from "@/features/floor/schemas/floor.ts"
import { useOpenOrder } from "@/features/ordering/api/orders.ts"
import { newId } from "@/lib/idempotency.ts"
import { cn } from "@/lib/utils.ts"

function Body({ table, onDone }: { table: FloorTable; onDone: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const open = useOpenOrder()
  const [guests, setGuests] = useState(Math.min(2, table.capacity))
  // One id per attempt: a double tap or a retry opens the same order, not two.
  const [orderId] = useState(newId)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {Array.from({ length: 8 }, (_, i) => i + 1).map((count) => (
          <Pressable
            key={count}
            role="radio"
            aria-checked={guests === count}
            onClick={() => setGuests(count)}
            className={cn(
              "h-14 rounded-2xl border font-heading text-xl font-semibold tabular-nums transition-colors",
              guests === count
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background"
            )}
          >
            {count}
          </Pressable>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <QtyStepper
          value={guests}
          min={1}
          max={50}
          onChange={setGuests}
          labels={{ decrease: "−", increase: "+" }}
        />
        <Button
          size="xl"
          className="flex-1"
          disabled={open.isPending}
          onClick={async () => {
            const order = await open.mutateAsync({
              id: orderId,
              table: table.id,
              guests,
            })
            onDone()
            await navigate({
              to: "/order/$orderId",
              params: { orderId: order.id },
            })
          }}
        >
          {open.isPending && <Spinner />}
          {t("order.open")}
        </Button>
      </div>
    </div>
  )
}

/** First tap on a free table: how many guests, then straight into the order. */
export function OpenTableSheet({
  table,
  onClose,
}: {
  table: FloorTable | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <TouchSheet
      open={table !== null}
      onOpenChange={(open) => !open && onClose()}
      title={table ? t("order.openTitle", { label: table.label }) : ""}
      description={t("order.openBody")}
    >
      {table && <Body key={table.id} table={table} onDone={onClose} />}
    </TouchSheet>
  )
}
