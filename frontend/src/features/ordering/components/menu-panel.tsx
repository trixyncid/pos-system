import { SearchIcon, StarIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useDeferredValue, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { ProductImage } from "@/components/pos/product-image.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import {
  useCategoriesQuery,
  useProductsQuery,
} from "@/features/catalog/api/catalog.ts"
import type { Product } from "@/features/catalog/schemas/catalog.ts"
import { MenuCard } from "@/features/ordering/components/menu-card.tsx"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

const FAVORITES = "favorites"

function Grid({
  products,
  onPick,
}: {
  products: Product[]
  onPick: (product: Product, source: Element | null) => void
}) {
  return (
    <motion.div
      layout
      className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {products.map((product) => (
          <MenuCard key={product.id} product={product} onPick={onPick} />
        ))}
      </AnimatePresence>
    </motion.div>
  )
}

/**
 * The left two thirds of the order screen: a category rail and the photo
 * grid, with search across every category. Favourites come first.
 */
export function MenuPanel({
  onPick,
}: {
  onPick: (product: Product, source: Element | null) => void
}) {
  const { t } = useTranslation()
  const categories = useCategoriesQuery()
  const menu = useProductsQuery("menu")
  const [selected, setSelected] = useState<string>(FAVORITES)
  const [search, setSearch] = useState("")
  const query = useDeferredValue(search.trim().toLowerCase())

  const live = useMemo(
    () => (menu.data ?? []).filter((product) => product.is_active),
    [menu.data]
  )
  const rail = (categories.data ?? []).filter(
    (category) =>
      category.is_active &&
      live.some((product) => product.category === category.id)
  )
  const favorites = live.filter((product) => product.is_favorite)
  const visible = query
    ? live.filter((product) => product.name.toLowerCase().includes(query))
    : selected === FAVORITES
      ? favorites
      : live.filter((product) => product.category === selected)

  return (
    <div className="grid min-h-0 grid-cols-[6.5rem_minmax(0,1fr)]">
      <nav
        aria-label={t("menu.categories")}
        className="min-h-0 space-y-1 overflow-y-auto overscroll-contain border-r p-2"
      >
        {[
          {
            id: FAVORITES,
            name: t("order.favorites"),
            image: null as string | null,
          },
          ...rail.map((category) => ({
            id: category.id,
            name: category.name,
            image:
              live.find(
                (product) =>
                  product.category === category.id && product.image_url
              )?.image_url ?? null,
          })),
        ].map((item) => {
          const active = !query && selected === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSelected(item.id)
                setSearch("")
              }}
              aria-current={active ? "true" : undefined}
              className={cn(
                "relative flex w-full flex-col items-center gap-1.5 rounded-2xl px-1.5 py-2.5 text-center text-xs leading-tight font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {active && (
                <motion.span
                  layoutId="order-rail"
                  transition={spring.layout}
                  className="absolute inset-0 rounded-2xl bg-card shadow-(--shadow-soft)"
                />
              )}
              <span className="relative grid size-12 place-items-center overflow-hidden rounded-xl bg-accent">
                {item.id === FAVORITES ? (
                  <StarIcon className="size-5 fill-warning text-warning" />
                ) : (
                  <ProductImage
                    src={item.image}
                    alt={item.name}
                    className="size-full"
                  />
                )}
              </span>
              <span className="relative line-clamp-2">{item.name}</span>
            </button>
          )
        })}
      </nav>

      <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("order.search")}
            aria-label={t("order.search")}
            className="h-12 rounded-xl bg-card pl-12 text-base"
          />
        </div>
        {menu.isPending ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="aspect-[4/4.4] rounded-3xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">
            {t("order.empty")}
          </p>
        ) : (
          <Grid products={visible} onPick={onPick} />
        )}
      </div>
    </div>
  )
}
