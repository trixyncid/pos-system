import { PackageIcon, PlusIcon, SearchIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useDeferredValue, useState } from "react"
import { useTranslation } from "react-i18next"

import { PageHeader } from "@/components/backoffice/page-header.tsx"
import { MoneyText } from "@/components/pos/money-text.tsx"
import { ProductImage } from "@/components/pos/product-image.tsx"
import { Segmented } from "@/components/pos/segmented.tsx"
import { StatusPill } from "@/components/pos/status-pill.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import {
  useCategoriesQuery,
  useModifierGroupsQuery,
  useProductsQuery,
} from "@/features/catalog/api/catalog.ts"
import { CategoryRail } from "@/features/catalog/components/category-rail.tsx"
import { CategorySheet } from "@/features/catalog/components/category-sheet.tsx"
import { ModifierGroupSheet } from "@/features/catalog/components/modifier-group-sheet.tsx"
import { ProductCard } from "@/features/catalog/components/product-card.tsx"
import { ProductSheet } from "@/features/catalog/components/product-sheet.tsx"
import {
  costRatio,
  costTone,
  formatPercent,
} from "@/features/catalog/lib/catalog.ts"
import type {
  Category,
  ModifierGroup,
  Product,
  ProductKind,
} from "@/features/catalog/schemas/catalog.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { formatIDR } from "@/lib/money.ts"
import { spring } from "@/lib/motion.ts"

type Tab = "menu" | "retail" | "ingredient" | "modifiers"

function matches(product: Product, search: string) {
  if (!search) return true
  const needle = search.toLowerCase()
  return (
    product.name.toLowerCase().includes(needle) ||
    product.sku.toLowerCase() === needle ||
    product.barcode === search
  )
}

function SearchBox({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="relative min-w-60 flex-1">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("menu.search")}
        aria-label={t("menu.search")}
        className="h-12 rounded-xl pl-12 text-base"
      />
    </div>
  )
}

function Empty() {
  const { t } = useTranslation()
  return (
    <p className="py-16 text-center text-muted-foreground">{t("menu.empty")}</p>
  )
}

function MenuTab({
  onOpen,
}: {
  onOpen: (product: Product | null, category: string | null) => void
}) {
  const { t } = useTranslation()
  const categories = useCategoriesQuery()
  const products = useProductsQuery("menu")
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<Category | null | undefined>(undefined)
  const [search, setSearch] = useState("")
  const query = useDeferredValue(search.trim())

  const menuCategories = (categories.data ?? []).filter(
    (category) =>
      category.station !== "none" ||
      (products.data ?? []).some((p) => p.category === category.id)
  )
  const visible = (products.data ?? []).filter(
    (product) =>
      (selected === null || product.category === selected) &&
      matches(product, query)
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        {categories.isPending ? (
          <Skeleton className="h-80 rounded-2xl" />
        ) : (
          <CategoryRail
            categories={menuCategories}
            selected={selected}
            onSelect={setSelected}
            onEdit={setEditing}
            onAdd={() => setEditing(null)}
            totalCount={products.data?.length ?? 0}
          />
        )}
      </aside>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <SearchBox value={search} onChange={setSearch} />
          <Button size="touch" onClick={() => onOpen(null, selected)}>
            <PlusIcon />
            {t("menu.addItem")}
          </Button>
        </div>
        {products.isPending ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(11.5rem,1fr))] gap-4">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="aspect-[4/4.2] rounded-3xl" />
            ))}
          </div>
        ) : products.isError ? (
          <p className="text-danger-ink">{apiErrorMessage(products.error)}</p>
        ) : visible.length === 0 ? (
          <Empty />
        ) : (
          <motion.div
            layout
            className="grid grid-cols-[repeat(auto-fill,minmax(11.5rem,1fr))] gap-4"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {visible.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onOpen={() => onOpen(product, null)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
      <CategorySheet category={editing} onClose={() => setEditing(undefined)} />
    </div>
  )
}

/** Snack-bar goods and ingredients: dense rows, since there are many and photos matter less. */
function ListTab({
  kind,
  onOpen,
}: {
  kind: "retail" | "ingredient"
  onOpen: (product: Product | null) => void
}) {
  const { t } = useTranslation()
  const products = useProductsQuery(kind)
  const [search, setSearch] = useState("")
  const query = useDeferredValue(search.trim())
  const visible = (products.data ?? []).filter((product) =>
    matches(product, query)
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <SearchBox value={search} onChange={setSearch} />
        <Button size="touch" onClick={() => onOpen(null)}>
          <PlusIcon />
          {kind === "retail" ? t("menu.addProduct") : t("menu.addIngredient")}
        </Button>
      </div>
      {products.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-18 rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Empty />
      ) : (
        <ul className="divide-y overflow-hidden rounded-3xl bg-card shadow-(--shadow-soft)">
          {visible.map((product) => {
            const ratio = costRatio(product.price, product.cost)
            return (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => onOpen(product)}
                  className="flex min-h-18 w-full items-center gap-4 px-4 py-3 text-left transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/60"
                >
                  {kind === "retail" ? (
                    <ProductImage
                      src={product.image_url}
                      alt={product.name}
                      className="size-12 shrink-0 rounded-xl"
                    />
                  ) : (
                    <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                      <PackageIcon className="size-5" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {product.name}
                      {!product.is_available && (
                        <StatusPill tone="danger" className="ml-2 align-middle">
                          {t("menu.soldOut")}
                        </StatusPill>
                      )}
                    </span>
                    <span className="block truncate font-mono text-sm text-muted-foreground">
                      {kind === "retail"
                        ? [product.barcode, product.sku]
                            .filter(Boolean)
                            .join(" · ")
                        : t("menu.costPerUnit", {
                            unit: t(`menu.units.${product.unit}`),
                          }) +
                          " " +
                          formatIDR(product.cost)}
                    </span>
                  </span>
                  {kind === "retail" && (
                    <span className="flex shrink-0 items-center gap-3">
                      {ratio !== null && (
                        <StatusPill tone={costTone(ratio, "retail")}>
                          {formatPercent(1 - ratio)}
                        </StatusPill>
                      )}
                      <MoneyText
                        amount={product.price}
                        className="w-24 text-right font-heading font-semibold"
                      />
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function ModifiersTab() {
  const { t } = useTranslation()
  const groups = useModifierGroupsQuery()
  const [editing, setEditing] = useState<ModifierGroup | null | undefined>(
    undefined
  )

  const rule = (group: ModifierGroup) =>
    group.min_select > 0
      ? `${t("menu.required")} · ${
          group.min_select === group.max_select
            ? t("menu.pickExactly", { count: group.min_select })
            : t("menu.pickUpTo", { count: group.max_select })
        }`
      : `${t("menu.optional")} · ${t("menu.pickUpTo", { count: group.max_select })}`

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="touch" onClick={() => setEditing(null)}>
          <PlusIcon />
          {t("menu.addGroup")}
        </Button>
      </div>
      {groups.isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-40 rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.data?.map((group, index) => (
            <motion.button
              key={group.id}
              type="button"
              onClick={() => setEditing(group)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.layout, delay: index * 0.04 }}
              whileTap={{ scale: 0.98 }}
              className="space-y-3 rounded-3xl bg-card p-5 text-left shadow-(--shadow-soft) outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-heading text-lg font-semibold">
                    {group.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("menu.usedBy", { count: group.product_count })}
                  </p>
                </div>
                <StatusPill tone={group.min_select > 0 ? "accent" : "neutral"}>
                  {rule(group)}
                </StatusPill>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.options.map((option) => (
                  <span
                    key={option.id}
                    className="rounded-full bg-muted px-3 py-1.5 text-sm"
                  >
                    {option.name}
                    {option.price_delta !== 0 && (
                      <span className="ml-1.5 text-muted-foreground tabular-nums">
                        +{formatIDR(option.price_delta).replace("Rp ", "")}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </motion.button>
          ))}
        </div>
      )}
      <ModifierGroupSheet
        group={editing}
        onClose={() => setEditing(undefined)}
      />
    </div>
  )
}

export function MenuPage() {
  const { t } = useTranslation()
  const categories = useCategoriesQuery()
  // New snack-bar goods start in the first category that prints nowhere (the snack bar).
  const snackCategory =
    categories.data?.find((category) => category.station === "none")?.id ?? null
  const [tab, setTab] = useState<Tab>("menu")
  const [open, setOpen] = useState<{
    kind: ProductKind
    product: Product | null
    category: string | null
  } | null>(null)

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
      <PageHeader title={t("menu.title")} description={t("menu.subtitle")} />
      <Segmented
        label={t("menu.title")}
        value={tab}
        onChange={setTab}
        className="w-full max-w-2xl"
        options={[
          { value: "menu", label: t("menu.tabMenu") },
          { value: "retail", label: t("menu.tabRetail") },
          { value: "ingredient", label: t("menu.tabIngredients") },
          { value: "modifiers", label: t("menu.tabModifiers") },
        ]}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.16 }}
        >
          {tab === "menu" && (
            <MenuTab
              onOpen={(product, category) =>
                setOpen({ kind: "menu", product, category })
              }
            />
          )}
          {(tab === "retail" || tab === "ingredient") && (
            <ListTab
              kind={tab}
              onOpen={(product) =>
                setOpen({ kind: tab, product, category: null })
              }
            />
          )}
          {tab === "modifiers" && <ModifiersTab />}
        </motion.div>
      </AnimatePresence>
      <ProductSheet
        kind={open?.kind ?? "menu"}
        product={open === null ? undefined : open.product}
        initialCategory={
          open?.kind === "retail" ? snackCategory : (open?.category ?? null)
        }
        onClose={() => setOpen(null)}
      />
    </div>
  )
}
