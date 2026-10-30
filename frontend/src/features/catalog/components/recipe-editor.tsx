import { PlusIcon, Trash2Icon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useTranslation } from "react-i18next"

import { MoneyText } from "@/components/pos/money-text.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx"
import type { Product } from "@/features/catalog/schemas/catalog.ts"
import { spring } from "@/lib/motion.ts"

export type RecipeDraft = { ingredient: string; quantity: number }

/** Ingredients per portion, each with its cost, so the owner sees the food cost build up. */
export function RecipeEditor({
  value,
  onChange,
  ingredients,
}: {
  value: RecipeDraft[]
  onChange: (value: RecipeDraft[]) => void
  ingredients: Product[]
}) {
  const { t } = useTranslation()
  const byId = new Map(ingredients.map((item) => [item.id, item]))
  const update = (index: number, patch: Partial<RecipeDraft>) =>
    onChange(
      value.map((line, i) => (i === index ? { ...line, ...patch } : line))
    )

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {value.map((line, index) => {
          const ingredient = byId.get(line.ingredient)
          const used = new Set(value.map((l) => l.ingredient))
          return (
            <motion.div
              key={`${index}-${line.ingredient}`}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={spring.layout}
              className="flex items-center gap-2"
            >
              <Select
                value={line.ingredient || undefined}
                onValueChange={(ingredientId) =>
                  update(index, { ingredient: ingredientId })
                }
              >
                <SelectTrigger size="lg" className="min-w-0 flex-1">
                  <SelectValue placeholder={t("menu.pickIngredient")} />
                </SelectTrigger>
                <SelectContent>
                  {ingredients.map((item) => (
                    <SelectItem
                      key={item.id}
                      value={item.id}
                      disabled={
                        used.has(item.id) && item.id !== line.ingredient
                      }
                      className="h-11 text-base"
                    >
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-32 shrink-0">
                <Input
                  inputMode="decimal"
                  aria-label={t("menu.quantity")}
                  className="h-12 rounded-xl pr-12 text-right text-base tabular-nums"
                  value={line.quantity ? String(line.quantity) : ""}
                  onChange={(event) =>
                    update(index, {
                      quantity:
                        Number(event.target.value.replace(",", ".")) || 0,
                    })
                  }
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs text-muted-foreground">
                  {ingredient ? t(`menu.units.${ingredient.unit}`) : ""}
                </span>
              </div>
              <MoneyText
                amount={
                  ingredient ? Math.round(ingredient.cost * line.quantity) : 0
                }
                className="w-24 shrink-0 text-right text-sm text-muted-foreground"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-touch"
                aria-label={t("common.cancel")}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                <Trash2Icon />
              </Button>
            </motion.div>
          )
        })}
      </AnimatePresence>
      <Button
        type="button"
        variant="outline"
        size="touch"
        onClick={() => onChange([...value, { ingredient: "", quantity: 1 }])}
      >
        <PlusIcon />
        {t("menu.addIngredientLine")}
      </Button>
    </div>
  )
}

export function recipeCost(lines: RecipeDraft[], ingredients: Product[]) {
  const byId = new Map(ingredients.map((item) => [item.id, item]))
  return Math.round(
    lines.reduce(
      (sum, line) =>
        sum + (byId.get(line.ingredient)?.cost ?? 0) * line.quantity,
      0
    )
  )
}
