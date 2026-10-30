import { PlusIcon } from "lucide-react"
import { motion } from "motion/react"
import { useRef } from "react"
import { useTranslation } from "react-i18next"

import { MoneyText } from "@/components/pos/money-text.tsx"
import { ProductImage } from "@/components/pos/product-image.tsx"
import type { Product } from "@/features/catalog/schemas/catalog.ts"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

/**
 * A menu item on the order screen. Tapping adds it straight to the cart, or
 * opens its choices when it has any; the photo carries a layoutId so it can
 * grow into the item sheet's hero image.
 */
export function MenuCard({
  product,
  onPick,
}: {
  product: Product
  onPick: (product: Product, source: Element | null) => void
}) {
  const { t } = useTranslation()
  const image = useRef<HTMLDivElement>(null)
  const soldOut = !product.is_available

  return (
    <motion.button
      type="button"
      disabled={soldOut}
      onClick={() => onPick(product, image.current)}
      whileTap={soldOut ? undefined : { scale: 0.96 }}
      transition={spring.press}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-3xl bg-card text-left shadow-(--shadow-soft) outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        soldOut && "cursor-not-allowed"
      )}
      aria-label={
        soldOut ? `${product.name}, ${t("order.soldOut")}` : product.name
      }
    >
      <motion.div
        ref={image}
        data-photo={product.id}
        layoutId={`menu-photo-${product.id}`}
        className="relative overflow-hidden"
      >
        <ProductImage
          src={product.image_url}
          alt={product.name}
          className={cn("aspect-4/3", soldOut && "opacity-50 grayscale")}
        />
        {soldOut && (
          <span className="absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-foreground/80 px-3 py-1 text-xs font-semibold text-background">
            {t("order.soldOut")}
          </span>
        )}
      </motion.div>
      <div className="flex flex-1 flex-col justify-between gap-1 px-3 pt-2.5 pb-3">
        <p className="line-clamp-2 text-sm leading-tight font-medium">
          {product.name}
        </p>
        <div className="flex items-center justify-between">
          <MoneyText
            amount={product.price}
            className="font-heading text-sm font-semibold"
          />
          {!soldOut && (
            <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground transition-transform group-active:scale-90">
              <PlusIcon className="size-4" />
            </span>
          )}
        </div>
      </div>
    </motion.button>
  )
}
