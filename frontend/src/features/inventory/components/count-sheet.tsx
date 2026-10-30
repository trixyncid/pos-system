import { SearchIcon } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { ProductImage } from "@/components/pos/product-image.tsx"
import { Segmented } from "@/components/pos/segmented.tsx"
import { TouchSheet } from "@/components/pos/touch-sheet.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import {
  useAllStockQuery,
  useCount,
} from "@/features/inventory/api/inventory.ts"
import {
  formatChange,
  formatQuantity,
  parseQuantity,
} from "@/features/inventory/lib/quantity.ts"
import { signedIDR } from "@/features/shifts/lib/variance.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { newId } from "@/lib/idempotency.ts"
import { cn } from "@/lib/utils.ts"

function Body({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const items = useAllStockQuery(true)
  const count = useCount()
  const countId = useRef(newId())
  const [kind, setKind] = useState<"all" | "ingredient" | "retail">("all")
  const [search, setSearch] = useState("")
  const [counted, setCounted] = useState<Record<string, string>>({})
  const [note, setNote] = useState("")

  const entered = (items.data ?? []).flatMap((item) => {
    const qty = parseQuantity(counted[item.id] ?? "")
    return Number.isNaN(qty) ? [] : [{ item, qty, diff: qty - item.stock }]
  })
  const value = entered.reduce(
    (sum, line) => sum + Math.round(line.diff * line.item.cost),
    0
  )
  const needle = search.trim().toLowerCase()
  const shown = (items.data ?? []).filter(
    (item) =>
      (kind === "all" || item.kind === kind) &&
      (!needle || item.name.toLowerCase().includes(needle))
  )

  const submit = async () => {
    try {
      const adjusted = await count.mutateAsync({
        id: countId.current,
        note,
        lines: entered.map((line) => ({
          product: line.item.id,
          counted: line.qty,
        })),
      })
      toast.success(
        t("inventory.counted", {
          count: entered.length,
          adjusted: adjusted.length,
        })
      )
      onDone()
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("inventory.search")}
            aria-label={t("inventory.search")}
            className="h-11 rounded-xl pl-11 text-base"
          />
        </div>
        <Segmented
          label={t("inventory.kind")}
          value={kind}
          onChange={setKind}
          options={[
            { value: "all", label: t("inventory.all") },
            { value: "ingredient", label: t("inventory.ingredients") },
            { value: "retail", label: t("inventory.goods") },
          ]}
        />
      </div>

      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain">
        {items.isPending &&
          Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        {shown.map((item) => {
          const text = counted[item.id] ?? ""
          const qty = parseQuantity(text)
          const diff = Number.isNaN(qty) ? null : qty - item.stock
          return (
            <li
              key={item.id}
              className={cn(
                "flex items-center gap-3 rounded-2xl border bg-background px-3 py-2 transition-colors",
                diff !== null && "border-primary/40"
              )}
            >
              <ProductImage
                src={item.image_url}
                alt=""
                className="size-10 shrink-0 rounded-xl"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t("inventory.system", {
                    amount: formatQuantity(item.stock, item.unit),
                  })}
                  {diff !== null && diff !== 0 && (
                    <span
                      className={cn(
                        "ml-2 font-medium",
                        diff > 0 ? "text-warning-ink" : "text-danger-ink"
                      )}
                    >
                      {formatChange(diff, item.unit)}
                    </span>
                  )}
                  {diff === 0 && (
                    <span className="ml-2 font-medium text-success-ink">
                      {t("inventory.match")}
                    </span>
                  )}
                </p>
              </div>
              <div className="relative w-32">
                <Input
                  inputMode="decimal"
                  value={text}
                  onChange={(event) =>
                    setCounted((all) => ({
                      ...all,
                      [item.id]: event.target.value,
                    }))
                  }
                  placeholder="—"
                  aria-label={t("inventory.countOf", { name: item.name })}
                  className="h-11 rounded-xl pr-11 text-right text-base tabular-nums"
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
                  {item.unit === "portion" ? "porsi" : item.unit}
                </span>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="shrink-0 space-y-3 border-t pt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">
            {t("inventory.countedSummary", { count: entered.length })}
          </span>
          <span
            className={cn(
              "font-heading text-xl font-semibold tabular-nums",
              value < 0 && "text-danger-ink",
              value > 0 && "text-warning-ink"
            )}
          >
            {signedIDR(value)}
          </span>
        </div>
        <Input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={120}
          placeholder={t("inventory.countNote")}
          className="h-11 rounded-xl text-base"
        />
        <Button
          size="xl"
          className="w-full"
          disabled={entered.length === 0 || count.isPending}
          onClick={() => void submit()}
        >
          {count.isPending && <Spinner />}
          {t("inventory.saveCount", { count: entered.length })}
        </Button>
      </div>
    </div>
  )
}

/** A stock count (opname): type what is on the shelf; only the items counted change. */
export function CountSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <TouchSheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      side="right"
      title={t("inventory.countTitle")}
      description={t("inventory.countBody")}
      className="w-[min(640px,calc(100vw-1rem))]"
    >
      {open && (
        <div className="h-[calc(100dvh-10rem)]">
          <Body onDone={onClose} />
        </div>
      )}
    </TouchSheet>
  )
}
