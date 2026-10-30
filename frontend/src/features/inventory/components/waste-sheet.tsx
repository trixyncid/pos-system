import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Pressable } from "@/components/motion/pressable.tsx"
import { TouchSheet } from "@/components/pos/touch-sheet.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import { useWaste } from "@/features/inventory/api/inventory.ts"
import {
  formatQuantity,
  parseQuantity,
} from "@/features/inventory/lib/quantity.ts"
import type { StockItem } from "@/features/inventory/schemas/inventory.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { formatIDR } from "@/lib/money.ts"
import { cn } from "@/lib/utils.ts"

function Body({ item, onDone }: { item: StockItem; onDone: () => void }) {
  const { t } = useTranslation()
  const waste = useWaste()
  const reasons = t("inventory.wasteReasons", {
    returnObjects: true,
  }) as unknown as string[]
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState("")
  const qty = parseQuantity(quantity)

  const submit = async () => {
    try {
      await waste.mutateAsync({ product: item.id, quantity: qty, reason })
      toast.success(
        t("inventory.wasted", {
          amount: formatQuantity(qty, item.unit),
          name: item.name,
        })
      )
      onDone()
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {t("inventory.onHandNow", {
          amount: formatQuantity(item.stock, item.unit),
        })}
      </p>
      <div className="relative">
        <Input
          inputMode="decimal"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          placeholder="0"
          aria-label={t("inventory.quantity")}
          className="h-14 rounded-2xl pr-16 font-heading text-2xl tabular-nums"
        />
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground">
          {item.unit === "portion" ? "porsi" : item.unit}
        </span>
      </div>
      {qty > 0 && (
        <p className="text-sm text-danger-ink">
          {t("inventory.wasteValue", {
            amount: formatIDR(Math.round(qty * item.cost)),
          })}
        </p>
      )}
      <div role="radiogroup" className="flex flex-wrap gap-2">
        {reasons.map((text) => (
          <Pressable
            key={text}
            role="radio"
            aria-checked={reason === text}
            onClick={() => setReason(text)}
            className={cn(
              "h-11 rounded-xl border px-4 text-sm font-medium transition-colors",
              reason === text
                ? "border-primary bg-primary/10 text-accent-foreground"
                : "bg-background"
            )}
          >
            {text}
          </Pressable>
        ))}
      </div>
      <Input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={120}
        placeholder={t("inventory.reason")}
        className="h-12 rounded-xl text-base"
      />
      <Button
        size="xl"
        variant="destructive"
        className="w-full"
        disabled={!(qty > 0) || !reason.trim() || waste.isPending}
        onClick={() => void submit()}
      >
        {waste.isPending && <Spinner />}
        {t("inventory.saveWaste")}
      </Button>
    </div>
  )
}

/** Spoiled, broken or dropped: taken out of stock with a reason, and audited. */
export function WasteSheet({
  item,
  onClose,
}: {
  item: StockItem | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <TouchSheet
      open={item !== null}
      onOpenChange={(open) => !open && onClose()}
      side="right"
      title={item ? t("inventory.wasteTitle", { name: item.name }) : ""}
      description={t("inventory.wasteBody")}
    >
      {item && <Body key={item.id} item={item} onDone={onClose} />}
    </TouchSheet>
  )
}
