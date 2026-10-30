import {
  CopyIcon,
  PencilIcon,
  PlusIcon,
  RotateCwIcon,
  Trash2Icon,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageHeader } from "@/components/backoffice/page-header.tsx"
import { QtyStepper } from "@/components/pos/qty-stepper.tsx"
import { Segmented } from "@/components/pos/segmented.tsx"
import { TouchSheet } from "@/components/pos/touch-sheet.tsx"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Field, FieldLabel } from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import { Switch } from "@/components/ui/switch.tsx"
import {
  useAreasQuery,
  useDeleteArea,
  useSaveArea,
  useSaveLayout,
} from "@/features/floor/api/floor.ts"
import { EditorCanvas } from "@/features/floor/components/editor-canvas.tsx"
import {
  CANVAS,
  type Area,
  type TableLayout,
} from "@/features/floor/schemas/floor.ts"
import { apiErrorMessage, apiFieldErrors } from "@/lib/api-error.ts"
import { newId } from "@/lib/idempotency.ts"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

const presets = {
  presetRound2: { shape: "round", width: 90, height: 90, capacity: 2 },
  presetRound4: { shape: "round", width: 110, height: 110, capacity: 4 },
  presetRect4: { shape: "rect", width: 120, height: 90, capacity: 4 },
  presetLong6: { shape: "rect", width: 180, height: 100, capacity: 6 },
} as const

function layoutOf(area: Area): TableLayout[] {
  return area.tables.map(
    ({ id, label, shape, x, y, width, height, rotation, capacity }) => ({
      id,
      label,
      shape,
      x,
      y,
      width,
      height,
      rotation,
      capacity,
    })
  )
}

/** The lowest whole number no table uses yet, in any area. */
function nextLabel(used: string[]) {
  const taken = new Set(used)
  let n = 1
  while (taken.has(String(n))) n += 1
  return String(n)
}

function AreaSheet({
  area,
  onClose,
}: {
  area: Area | null | undefined
  onClose: (created?: Area) => void
}) {
  const { t } = useTranslation()
  const save = useSaveArea()
  const remove = useDeleteArea()
  const [name, setName] = useState(area?.name ?? "")
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)

  return (
    <TouchSheet
      open={area !== undefined}
      onOpenChange={(open) => !open && onClose()}
      title={area ? t("floor.renameArea") : t("floor.addArea")}
    >
      <form
        className="space-y-5"
        onSubmit={async (event) => {
          event.preventDefault()
          try {
            const saved = await save.mutateAsync({ id: area?.id, name })
            toast.success(t("floor.areaSaved", { name: saved.name }))
            onClose(area ? undefined : saved)
          } catch (err) {
            setError(apiFieldErrors(err).name ?? apiErrorMessage(err))
          }
        }}
      >
        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor="area-name">{t("floor.areaName")}</FieldLabel>
          <Input
            id="area-name"
            autoFocus
            className="h-12 rounded-xl text-base"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setError(null)
            }}
          />
          {error && <p className="text-sm text-danger-ink">{error}</p>}
        </Field>
        <div className="flex gap-3">
          {area && (
            <Button
              type="button"
              variant="destructive"
              size="xl"
              aria-label={t("floor.deleteArea")}
              onClick={() => setConfirm(true)}
            >
              <Trash2Icon />
            </Button>
          )}
          <Button
            type="submit"
            size="xl"
            className="flex-1"
            disabled={!name.trim() || save.isPending}
          >
            {save.isPending && <Spinner />}
            {t("common.save")}
          </Button>
        </div>
      </form>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("floor.deleteAreaConfirm", { name: area?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("floor.deleteAreaBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (!area) return
                await remove.mutateAsync(area.id)
                toast.success(t("floor.areaDeleted", { name: area.name }))
                onClose()
              }}
            >
              {t("floor.deleteArea")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TouchSheet>
  )
}

export function FloorEditorPage() {
  const { t } = useTranslation()
  const areas = useAreasQuery({ includeInactive: true })
  const saveLayout = useSaveLayout()
  const [areaId, setAreaId] = useState<string | null>(null)
  // Unsaved edits per area, so switching tabs keeps them.
  const [drafts, setDrafts] = useState<Record<string, TableLayout[]>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [snap, setSnap] = useState(true)
  const [editingArea, setEditingArea] = useState<Area | null | undefined>(
    undefined
  )

  if (areas.isPending)
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
        <Skeleton className="h-16 w-96 rounded-2xl" />
        <Skeleton className="aspect-10/7 rounded-3xl" />
      </div>
    )
  if (areas.isError)
    return <p className="p-8 text-danger-ink">{apiErrorMessage(areas.error)}</p>

  const area = areas.data.find((item) => item.id === areaId) ?? areas.data[0]
  const saved = area ? layoutOf(area) : []
  const tables = area ? (drafts[area.id] ?? saved) : []
  const dirty =
    area !== undefined &&
    drafts[area.id] !== undefined &&
    JSON.stringify(drafts[area.id]) !== JSON.stringify(saved)
  const selected = tables.find((table) => table.id === selectedId) ?? null
  const allLabels = areas.data.flatMap((item) =>
    (drafts[item.id] ?? layoutOf(item)).map((table) => table.label)
  )

  const setTables = (next: TableLayout[]) => {
    if (area) setDrafts((current) => ({ ...current, [area.id]: next }))
  }
  const patch = (id: string, change: Partial<TableLayout>) =>
    setTables(
      tables.map((table) => (table.id === id ? { ...table, ...change } : table))
    )

  const add = (preset: (typeof presets)[keyof typeof presets]) => {
    // New tables land in the middle, stepped so several in a row don't stack.
    const offset = (tables.length % 5) * 30
    const table: TableLayout = {
      id: newId(),
      label: nextLabel(allLabels),
      rotation: 0,
      x: CANVAS.width / 2 + offset,
      y: CANVAS.height / 2 + offset,
      ...preset,
    }
    setTables([...tables, table])
    setSelectedId(table.id)
  }

  const save = async () => {
    if (!area) return
    try {
      await saveLayout.mutateAsync({ areaId: area.id, tables })
      setDrafts(({ [area.id]: _, ...rest }) => rest)
      toast.success(t("floor.saved", { name: area.name }))
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 pb-28 lg:p-8">
      <PageHeader
        title={t("floor.editorTitle")}
        description={t("floor.editorSubtitle")}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex gap-1 rounded-2xl bg-muted p-1">
          {areas.data.map((item) => {
            const active = item.id === area?.id
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setAreaId(item.id)
                  setSelectedId(null)
                }}
                className={cn(
                  "relative flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="editor-area"
                    transition={spring.layout}
                    className="absolute inset-0 rounded-xl bg-background shadow-(--shadow-soft)"
                  />
                )}
                <span className="relative">{item.name}</span>
                {drafts[item.id] && (
                  <span
                    className="relative size-2 rounded-full bg-primary"
                    aria-hidden
                  />
                )}
              </button>
            )
          })}
        </div>
        {area && (
          <Button
            variant="ghost"
            size="icon-touch"
            aria-label={t("floor.renameArea")}
            onClick={() => setEditingArea(area)}
          >
            <PencilIcon />
          </Button>
        )}
        <Button
          variant="outline"
          size="touch"
          onClick={() => setEditingArea(null)}
        >
          <PlusIcon />
          {t("floor.addArea")}
        </Button>
      </div>

      {area && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(presets) as (keyof typeof presets)[]).map((key) => (
                <Button
                  key={key}
                  variant="secondary"
                  size="touch"
                  onClick={() => add(presets[key])}
                >
                  <PlusIcon />
                  {t(`floor.${key}`)}
                </Button>
              ))}
              <label className="ml-auto flex h-12 cursor-pointer items-center gap-3 text-sm text-muted-foreground">
                {t("floor.snap")}
                <Switch checked={snap} onCheckedChange={setSnap} />
              </label>
            </div>
            <EditorCanvas
              tables={tables}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChange={patch}
              snap={snap}
            />
            <p className="text-sm text-muted-foreground">
              {t("floor.tablesCount", { count: tables.length })}
            </p>
          </div>

          <aside className="rounded-3xl bg-card p-5 shadow-(--shadow-soft) lg:sticky lg:top-6 lg:self-start">
            <AnimatePresence mode="wait" initial={false}>
              {selected ? (
                <motion.div
                  key={selected.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={spring.sheet}
                  className="space-y-5"
                >
                  <p className="font-heading font-semibold">
                    {t("floor.selected")}
                  </p>
                  <Field>
                    <FieldLabel htmlFor="table-label">
                      {t("floor.label")}
                    </FieldLabel>
                    <Input
                      id="table-label"
                      maxLength={12}
                      className="h-12 rounded-xl font-heading text-lg"
                      value={selected.label}
                      onChange={(event) =>
                        patch(selected.id, { label: event.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("floor.capacity")}</FieldLabel>
                    <QtyStepper
                      value={selected.capacity}
                      min={1}
                      max={20}
                      onChange={(capacity) => patch(selected.id, { capacity })}
                      labels={{ decrease: "−", increase: "+" }}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("floor.shape")}</FieldLabel>
                    <Segmented
                      label={t("floor.shape")}
                      value={selected.shape}
                      className="w-full"
                      onChange={(shape) =>
                        patch(
                          selected.id,
                          shape === "round"
                            ? { shape, height: selected.width }
                            : { shape }
                        )
                      }
                      options={[
                        { value: "rect", label: t("floor.shapeRect") },
                        { value: "round", label: t("floor.shapeRound") },
                      ]}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      size="touch"
                      onClick={() =>
                        patch(selected.id, {
                          rotation: (selected.rotation + 45) % 360,
                        })
                      }
                    >
                      <RotateCwIcon />
                      45°
                    </Button>
                    <Button
                      variant="secondary"
                      size="touch"
                      onClick={() => {
                        const copy = {
                          ...selected,
                          id: newId(),
                          label: nextLabel(allLabels),
                          x: Math.min(CANVAS.width, selected.x + 40),
                          y: Math.min(CANVAS.height, selected.y + 40),
                        }
                        setTables([...tables, copy])
                        setSelectedId(copy.id)
                      }}
                    >
                      <CopyIcon />
                      {t("floor.duplicate")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="touch"
                      className="col-span-2"
                      onClick={() => {
                        setTables(
                          tables.filter((table) => table.id !== selected.id)
                        )
                        setSelectedId(null)
                      }}
                    >
                      <Trash2Icon />
                      {t("floor.remove")}
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.p
                  key="hint"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-muted-foreground"
                >
                  {t("floor.selectHint")}
                </motion.p>
              )}
            </AnimatePresence>
          </aside>
        </div>
      )}

      <AnimatePresence>
        {dirty && area && (
          <motion.div
            initial={{ y: 96, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 96, opacity: 0 }}
            transition={spring.sheet}
            className="fixed right-4 bottom-4 left-24 z-30 mx-auto flex max-w-2xl items-center gap-3 rounded-2xl border bg-card/95 p-3 pl-5 shadow-(--shadow-overlay) backdrop-blur lg:left-[17rem]"
          >
            <p className="min-w-0 flex-1 truncate text-sm font-medium">
              {t("floor.unsaved")}
            </p>
            <Button
              variant="ghost"
              size="touch"
              onClick={() => {
                setDrafts(({ [area.id]: _, ...rest }) => rest)
                setSelectedId(null)
              }}
            >
              {t("floor.discard")}
            </Button>
            <Button
              size="touch"
              disabled={saveLayout.isPending}
              onClick={() => void save()}
            >
              {saveLayout.isPending && <Spinner />}
              {t("common.save")}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AreaSheet
        key={editingArea === undefined ? "closed" : (editingArea?.id ?? "new")}
        area={editingArea}
        onClose={(created) => {
          setEditingArea(undefined)
          if (created) setAreaId(created.id)
        }}
      />
    </div>
  )
}
