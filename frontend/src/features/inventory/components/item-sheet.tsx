import { PackagePlusIcon, Trash2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { MoneyText } from "@/components/pos/money-text.tsx"
import { ProductImage } from "@/components/pos/product-image.tsx"
import { StatusPill } from "@/components/pos/status-pill.tsx"
import { TouchSheet } from "@/components/pos/touch-sheet.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { useMovementsQuery } from "@/features/inventory/api/inventory.ts"
import { MovementList } from "@/features/inventory/components/movement-list.tsx"
import { StockBar } from "@/features/inventory/components/stock-bar.tsx"
import { formatQuantity } from "@/features/inventory/lib/quantity.ts"
import { statusTone } from "@/features/inventory/lib/tones.ts"
import type { StockItem } from "@/features/inventory/schemas/inventory.ts"

function Body({
  item,
  onReceive,
  onWaste,
}: {
  item: StockItem
  onReceive: () => void
  onWaste: () => void
}) {
  const { t } = useTranslation()
  const history = useMovementsQuery({ product: item.id })
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <ProductImage
          src={item.image_url}
          alt=""
          className="size-20 shrink-0 rounded-2xl"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <StatusPill tone={statusTone[item.status]}>
            {t(`inventory.status.${item.status}`)}
          </StatusPill>
          <p className="font-heading text-3xl font-semibold tabular-nums">
            {formatQuantity(item.stock, item.unit)}
          </p>
          <StockBar
            stock={item.stock}
            threshold={item.low_stock_threshold}
            status={item.status}
          />
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-2xl bg-background p-3">
          <dt className="text-muted-foreground">{t("inventory.lowAt")}</dt>
          <dd className="font-medium tabular-nums">
            {item.low_stock_threshold === null
              ? "—"
              : formatQuantity(item.low_stock_threshold, item.unit)}
          </dd>
        </div>
        <div className="rounded-2xl bg-background p-3">
          <dt className="text-muted-foreground">{t("inventory.avgCost")}</dt>
          <dd className="font-medium">
            <MoneyText amount={item.cost} />
          </dd>
        </div>
        <div className="rounded-2xl bg-background p-3">
          <dt className="text-muted-foreground">{t("inventory.value")}</dt>
          <dd className="font-medium">
            <MoneyText amount={item.value} />
          </dd>
        </div>
      </dl>
      <div className="flex gap-2">
        <Button size="touch" className="flex-1" onClick={onReceive}>
          <PackagePlusIcon />
          {t("inventory.receive")}
        </Button>
        <Button
          size="touch"
          variant="secondary"
          className="flex-1"
          onClick={onWaste}
        >
          <Trash2Icon />
          {t("inventory.waste")}
        </Button>
      </div>
      <section className="space-y-2">
        <h3 className="font-heading font-semibold">{t("inventory.history")}</h3>
        {history.isPending ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : history.data?.results.length ? (
          <MovementList movements={history.data.results} showProduct={false} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("inventory.noMovements")}
          </p>
        )}
      </section>
    </div>
  )
}

/** One item: what's on hand, its cost, and its recent movements. */
export function ItemSheet({
  item,
  onClose,
  onReceive,
  onWaste,
}: {
  item: StockItem | null
  onClose: () => void
  onReceive: (item: StockItem) => void
  onWaste: (item: StockItem) => void
}) {
  return (
    <TouchSheet
      open={item !== null}
      onOpenChange={(open) => !open && onClose()}
      side="center"
      title={item?.name ?? ""}
      description={item?.category_name ?? undefined}
      className="w-[min(560px,calc(100vw-1rem))]"
    >
      {item && (
        <Body
          key={item.id}
          item={item}
          onReceive={() => onReceive(item)}
          onWaste={() => onWaste(item)}
        />
      )}
    </TouchSheet>
  )
}
