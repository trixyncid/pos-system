import { PlusIcon, SearchIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Pressable } from "@/components/motion/pressable.tsx"
import { ProductImage } from "@/components/pos/product-image.tsx"
import { Input } from "@/components/ui/input.tsx"
import { formatQuantity } from "@/features/inventory/lib/quantity.ts"
import type { StockItem } from "@/features/inventory/schemas/inventory.ts"

/** Search the tracked items and tap one to add it as a line. */
export function ItemPicker({
  items,
  exclude,
  onPick,
}: {
  items: StockItem[]
  exclude: ReadonlySet<string>
  onPick: (item: StockItem) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const needle = query.trim().toLowerCase()
  const matches = needle
    ? items
        .filter(
          (item) =>
            !exclude.has(item.id) &&
            (item.name.toLowerCase().includes(needle) ||
              item.sku.toLowerCase().includes(needle) ||
              item.barcode === needle)
        )
        .slice(0, 6)
    : []

  return (
    <div className="space-y-2">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            const first = matches[0]
            if (event.key === "Enter" && first) {
              event.preventDefault()
              onPick(first)
              setQuery("")
            }
          }}
          placeholder={t("inventory.pickItem")}
          aria-label={t("inventory.pickItem")}
          className="h-12 rounded-xl pl-11 text-base"
        />
      </div>
      {matches.length > 0 && (
        <ul className="space-y-1 rounded-2xl border bg-background p-1.5">
          {matches.map((item) => (
            <li key={item.id}>
              <Pressable
                pressScale={0.98}
                onClick={() => {
                  onPick(item)
                  setQuery("")
                }}
                className="flex h-12 w-full items-center gap-3 rounded-xl px-2 text-left active:bg-muted"
              >
                <ProductImage
                  src={item.image_url}
                  alt=""
                  className="size-9 shrink-0 rounded-lg"
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {item.name}
                </span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {formatQuantity(item.stock, item.unit)}
                </span>
                <PlusIcon className="size-4 text-primary" />
              </Pressable>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
