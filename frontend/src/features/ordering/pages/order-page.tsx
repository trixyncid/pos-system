import { Link, useNavigate, useParams } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  ArrowRightLeftIcon,
  CombineIcon,
  MoreHorizontalIcon,
  UsersIcon,
  XCircleIcon,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { QtyStepper } from "@/components/pos/qty-stepper.tsx"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import {
  useModifierGroupsQuery,
  useProductsQuery,
} from "@/features/catalog/api/catalog.ts"
import type { Product } from "@/features/catalog/schemas/catalog.ts"
import { minutesSince } from "@/features/floor/lib/status.ts"
import {
  useAddLines,
  useCancelOrder,
  useMergeOrder,
  useMoveOrder,
  useOrderQuery,
  useSendHeld,
  useSetGuests,
} from "@/features/ordering/api/orders.ts"
import { CartPanel } from "@/features/ordering/components/cart-panel.tsx"
import {
  FlightLayer,
  flyToCart,
} from "@/features/ordering/components/fly-to-cart.tsx"
import { ItemDialog } from "@/features/ordering/components/item-dialog.tsx"
import { MenuPanel } from "@/features/ordering/components/menu-panel.tsx"
import { TablePickerSheet } from "@/features/ordering/components/table-picker-sheet.tsx"
import { VoidSheet } from "@/features/ordering/components/void-sheet.tsx"
import type { DraftLine, OrderLine } from "@/features/ordering/schemas/order.ts"
import { useDrafts, useOrderDrafts } from "@/features/ordering/store/drafts.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { newId } from "@/lib/idempotency.ts"
import { useNow } from "@/lib/use-now.ts"

/** A short buzz on Android when something reaches the kitchen. iPad has no vibration API. */
function buzz() {
  navigator.vibrate?.(25)
}

export function OrderPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { orderId } = useParams({ from: "/app/pos/order/$orderId" })
  const order = useOrderQuery(orderId)
  const groups = useModifierGroupsQuery()
  const menu = useProductsQuery("menu")
  const drafts = useOrderDrafts(orderId)
  const { add, update, remove, clear } = useDrafts()
  const addLines = useAddLines()
  const sendHeld = useSendHeld()
  const move = useMoveOrder()
  const merge = useMergeOrder()
  const cancel = useCancelOrder()
  const setGuests = useSetGuests()
  const now = useNow()

  const [picking, setPicking] = useState<{
    product: Product
    draft?: DraftLine
  } | null>(null)
  const [voiding, setVoiding] = useState<OrderLine | null>(null)
  const [tableMode, setTableMode] = useState<"move" | "merge" | null>(null)
  const [guestsOpen, setGuestsOpen] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  if (order.isPending)
    return (
      <div className="grid h-full grid-cols-[minmax(0,1fr)_23rem] gap-4 p-4">
        <Skeleton className="rounded-3xl" />
        <Skeleton className="rounded-3xl" />
      </div>
    )
  if (
    order.isError ||
    order.data.status === "merged" ||
    order.data.status === "void"
  )
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div className="space-y-4">
          <p className="text-muted-foreground">
            {order.isError ? t("order.notFound") : t("order.closed")}
          </p>
          <Button asChild size="touch">
            <Link to="/floor">
              <ArrowLeftIcon />
              {t("order.back")}
            </Link>
          </Button>
        </div>
      </div>
    )

  const current = order.data
  const title = current.table_label
    ? t("order.table", { label: current.table_label })
    : t("order.takeaway", { number: current.number })
  const minutes = minutesSince(current.created_at, now)
  const hasSent = current.lines.some((line) => line.status === "sent")

  const pick = (product: Product, source: Element | null) => {
    if (product.modifier_groups.length > 0) {
      setPicking({ product })
      return
    }
    add(orderId, {
      id: newId(),
      product: product.id,
      name: product.name,
      image: product.image_url,
      unit_price: product.price,
      quantity: 1,
      modifiers: [],
      note: "",
      seat: null,
      hold: false,
    })
    flyToCart(source, product.image_url)
  }

  const send = async () => {
    const sendNow = drafts.filter((line) => !line.hold)
    const later = drafts.filter((line) => line.hold)
    try {
      if (sendNow.length)
        await addLines.mutateAsync({ orderId, lines: sendNow, send: true })
      if (later.length)
        await addLines.mutateAsync({ orderId, lines: later, send: false })
      clear(
        orderId,
        drafts.map((line) => line.id)
      )
      const count = (lines: DraftLine[]) =>
        lines.reduce((sum, line) => sum + line.quantity, 0)
      if (sendNow.length) {
        buzz()
        toast.success(t("order.sentToast", { count: count(sendNow) }))
      } else {
        toast.success(t("order.savedToast", { count: count(later) }))
      }
      return sendNow.length > 0
    } catch (error) {
      toast.error(apiErrorMessage(error))
      return false
    }
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_23rem]">
      <div className="flex min-h-0 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4">
          <Button asChild variant="ghost" size="touch" className="px-3">
            <Link to="/floor">
              <ArrowLeftIcon />
              {t("order.back")}
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-heading text-xl font-semibold">
              {title}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              #{current.number} · {current.waiter}
              {minutes !== null &&
                ` · ${t("floor.minutes", { count: minutes })}`}
            </p>
          </div>
          <Button
            variant="secondary"
            size="touch"
            onClick={() => setGuestsOpen(true)}
          >
            <UsersIcon />
            {current.guests}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-touch"
                aria-label={t("staff.edit")}
              >
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                className="h-11"
                disabled={!current.table}
                onSelect={() => setTableMode("move")}
              >
                <ArrowRightLeftIcon />
                {t("order.move")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="h-11"
                disabled={!current.table}
                onSelect={() => setTableMode("merge")}
              >
                <CombineIcon />
                {t("order.merge")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="h-11"
                variant="destructive"
                disabled={hasSent}
                onSelect={() => setConfirmCancel(true)}
              >
                <XCircleIcon />
                {t("order.cancelOrder")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <MenuPanel onPick={pick} />
      </div>

      <CartPanel
        order={current}
        drafts={drafts}
        sending={addLines.isPending}
        onEditDraft={(line) => {
          // The full product, so its choices are current.
          const product = menu.data?.find((item) => item.id === line.product)
          if (product) setPicking({ product, draft: line })
        }}
        onRemoveDraft={(line) => remove(orderId, line.id)}
        onToggleHold={(line) => update(orderId, line.id, { hold: !line.hold })}
        onVoid={setVoiding}
        onSend={send}
        onSendHeld={async () => {
          try {
            await sendHeld.mutateAsync({ orderId })
            buzz()
            toast.success(
              t("order.sentToast", {
                count: current.lines.filter((l) => l.status === "held").length,
              })
            )
          } catch (error) {
            toast.error(apiErrorMessage(error))
          }
        }}
      />

      <ItemDialog
        product={picking?.product ?? null}
        groups={groups.data ?? []}
        guests={current.guests}
        draft={picking?.draft}
        onClose={() => setPicking(null)}
        onConfirm={(line) => {
          if (picking?.draft) update(orderId, picking.draft.id, line)
          else {
            add(orderId, { ...line, id: newId(), hold: false })
            flyToCart(
              document.querySelector(`[data-photo="${line.product}"]`),
              line.image
            )
          }
          setPicking(null)
        }}
      />
      <FlightLayer />
      <VoidSheet
        orderId={orderId}
        line={voiding}
        onClose={() => setVoiding(null)}
      />
      <TablePickerSheet
        mode={tableMode}
        currentTableId={current.table}
        onClose={() => setTableMode(null)}
        onPick={async (table) => {
          try {
            if (tableMode === "move") {
              await move.mutateAsync({ orderId, table: table.id })
              toast.success(t("order.moved", { label: table.label }))
            } else if (table.order_id) {
              await merge.mutateAsync({ orderId, source: table.order_id })
              toast.success(t("order.merged", { label: table.label }))
            }
            setTableMode(null)
          } catch (error) {
            toast.error(apiErrorMessage(error))
          }
        }}
      />
      <TouchSheet
        open={guestsOpen}
        onOpenChange={setGuestsOpen}
        title={t("order.editGuests")}
      >
        <div className="flex justify-center pb-4">
          <QtyStepper
            value={current.guests}
            min={1}
            max={50}
            onChange={(guests) => setGuests.mutate({ orderId, guests })}
            labels={{ decrease: "−", increase: "+" }}
          />
        </div>
      </TouchSheet>
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("order.cancelConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("order.cancelBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                await cancel.mutateAsync(orderId)
                clear(orderId)
                toast.success(t("order.cancelled"))
                await navigate({ to: "/floor" })
              }}
            >
              {t("order.cancelOrder")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
