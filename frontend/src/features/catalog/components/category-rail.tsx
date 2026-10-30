import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  CookingPotIcon,
  CupSodaIcon,
  EyeOffIcon,
  PencilIcon,
  PlusIcon,
  ShoppingBagIcon,
} from "lucide-react"
import { motion } from "motion/react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button.tsx"
import { useReorderCategories } from "@/features/catalog/api/catalog.ts"
import type { Category, Station } from "@/features/catalog/schemas/catalog.ts"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

const stationIcon: Record<Station, typeof CookingPotIcon> = {
  kitchen: CookingPotIcon,
  bar: CupSodaIcon,
  none: ShoppingBagIcon,
}

function Item({
  category,
  active,
  onSelect,
  onEdit,
}: {
  category: Category
  active: boolean
  onSelect: () => void
  onEdit: () => void
}) {
  const { t } = useTranslation()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id })
  const Icon = stationIcon[category.station]
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "relative flex items-center",
        isDragging && "z-10 opacity-90 shadow-(--shadow-raised)"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        {...attributes}
        {...listeners}
        className={cn(
          "relative flex h-14 min-w-0 flex-1 touch-none items-center gap-3 rounded-2xl pr-12 pl-3 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {active && (
          <motion.span
            layoutId="category-rail"
            transition={spring.layout}
            className="absolute inset-0 rounded-2xl bg-card shadow-(--shadow-soft)"
          />
        )}
        <Icon className="relative size-5 shrink-0" />
        <span className="relative min-w-0 flex-1">
          <span className="block truncate font-medium">{category.name}</span>
          <span className="block text-xs">
            {category.product_count}
            {!category.is_active && (
              <EyeOffIcon className="ml-1.5 inline size-3" />
            )}
          </span>
        </span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1.5 size-10 rounded-xl"
        aria-label={t("menu.editCategory")}
        onClick={onEdit}
      >
        <PencilIcon />
      </Button>
    </li>
  )
}

/**
 * Categories in the order the order screen shows them. Long-press (touch) or
 * drag (mouse) to reorder; the new order saves at once.
 */
export function CategoryRail({
  categories,
  selected,
  onSelect,
  onEdit,
  onAdd,
  totalCount,
}: {
  categories: Category[]
  selected: string | null
  onSelect: (id: string | null) => void
  onEdit: (category: Category) => void
  onAdd: () => void
  totalCount: number
}) {
  const { t } = useTranslation()
  const reorder = useReorderCategories()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // Touch: a short press starts the drag, so a quick tap still selects.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const ids = categories.map((category) => category.id)
    reorder.mutate(
      arrayMove(
        ids,
        ids.indexOf(String(active.id)),
        ids.indexOf(String(over.id))
      ),
      { onSuccess: () => toast.success(t("menu.reordered")) }
    )
  }

  return (
    <nav aria-label={t("menu.categories")} className="space-y-2">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "relative flex h-12 w-full items-center justify-between rounded-2xl px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          selected === null ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {selected === null && (
          <motion.span
            layoutId="category-rail"
            transition={spring.layout}
            className="absolute inset-0 rounded-2xl bg-card shadow-(--shadow-soft)"
          />
        )}
        <span className="relative">{t("menu.all")}</span>
        <span className="relative text-xs">{totalCount}</span>
      </button>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={categories.map((category) => category.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-1">
            {categories.map((category) => (
              <Item
                key={category.id}
                category={category}
                active={selected === category.id}
                onSelect={() => onSelect(category.id)}
                onEdit={() => onEdit(category)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <p className="px-3 text-xs text-muted-foreground">{t("menu.dragHint")}</p>
      <Button
        type="button"
        variant="outline"
        size="touch"
        className="w-full"
        onClick={onAdd}
      >
        <PlusIcon />
        {t("menu.addCategory")}
      </Button>
    </nav>
  )
}
