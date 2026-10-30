import { StarIcon } from "lucide-react"
import { motion } from "motion/react"
import { useTranslation } from "react-i18next"

import { MoneyText } from "@/components/pos/money-text.tsx"
import { ProductImage } from "@/components/pos/product-image.tsx"
import { StatusPill } from "@/components/pos/status-pill.tsx"
import { Switch } from "@/components/ui/switch.tsx"
import { useSetAvailable } from "@/features/catalog/api/catalog.ts"
import {
  costRatio,
  costTone,
  formatPercent,
  unitCost,
} from "@/features/catalog/lib/catalog.ts"
import type { Product } from "@/features/catalog/schemas/catalog.ts"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

/**
 * A menu item in the back office: photo, price, food cost, and a sold-out
 * switch that flips without opening the editor (the common mid-service change).
 */
export function ProductCard({
  product,
  onOpen,
}: {
  product: Product
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const setAvailable = useSetAvailable()
  const ratio = costRatio(product.price, unitCost(product))

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={spring.layout}
      className="group relative overflow-hidden rounded-3xl bg-card shadow-(--shadow-soft)"
    >
      <motion.button
        type="button"
        onClick={onOpen}
        whileTap={{ scale: 0.98 }}
        transition={spring.press}
        className="block w-full text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="relative">
          <ProductImage
            src={product.image_url}
            alt={product.name}
            className={cn(
              "aspect-4/3 transition-[filter] duration-300",
              !product.is_available && "grayscale"
            )}
          />
          {!product.is_available && (
            <span className="absolute top-3 left-3 rounded-full bg-foreground/80 px-3 py-1 text-xs font-semibold text-background backdrop-blur">
              {t("menu.soldOut")}
            </span>
          )}
          {product.is_favorite && (
            <span
              className="absolute top-3 right-3 grid size-8 place-items-center rounded-full bg-background/85 text-warning backdrop-blur"
              aria-label={t("menu.favorite")}
            >
              <StarIcon className="size-4 fill-current" />
            </span>
          )}
        </div>
        <div className="space-y-1.5 px-4 pt-3 pb-2">
          <p className="line-clamp-2 min-h-10 leading-tight font-medium">
            {product.name}
          </p>
          <div className="flex items-center justify-between gap-2">
            <MoneyText
              amount={product.price}
              className="font-heading font-semibold"
            />
            {ratio !== null && (
              <StatusPill tone={costTone(ratio, product.kind)}>
                {formatPercent(ratio)}
              </StatusPill>
            )}
          </div>
        </div>
      </motion.button>
      <label className="flex h-12 cursor-pointer items-center justify-between border-t px-4 text-sm text-muted-foreground">
        {product.is_available ? t("menu.available") : t("menu.soldOut")}
        <Switch
          checked={product.is_available}
          onCheckedChange={(is_available) =>
            setAvailable.mutate({
              id: product.id,
              kind: product.kind,
              is_available,
            })
          }
          aria-label={t("menu.available")}
        />
      </label>
    </motion.div>
  )
}
