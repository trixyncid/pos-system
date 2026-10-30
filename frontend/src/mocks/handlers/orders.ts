import { delay, http, HttpResponse } from "msw"

import { perm } from "@/features/auth/lib/permissions.ts"
import type { Order, OrderLine } from "@/features/ordering/schemas/order.ts"
import type {
  PrintJob,
  TicketPayload,
} from "@/features/printing/schemas/print-job.ts"
import { mockId, modifierGroups, products } from "@/mocks/db/catalog.ts"
import {
  billPayload,
  blankOrder,
  findTable,
  linesBill,
  orders,
  printJobs,
  pushJob,
  recompute,
  stationOf,
  ticketPayload,
} from "@/mocks/db/orders.ts"
import { audit } from "@/mocks/db/audit.ts"
import { promoDiscount, promos, unavailableReason } from "@/mocks/db/promos.ts"
import { deductSale, returnRefund, returnVoid } from "@/mocks/db/inventory.ts"
import {
  currentShift,
  refreshTotals,
  shiftPayments,
  shiftRefunds,
} from "@/mocks/db/shifts.ts"
import { permissionsOf, staff, type MockStaff } from "@/mocks/db/staff.ts"
import { bearerStaff } from "@/mocks/handlers/auth.ts"
import { apiPath, fail, ok } from "@/mocks/http.ts"
import { bus } from "@/realtime/bus.ts"

function actorWith(request: Request, permission: string) {
  const actor = bearerStaff(request)
  if (!actor)
    return {
      error: fail(401, "Authentication credentials were not provided.", {
        code: "not_authenticated",
      }),
    }
  if (!permissionsOf(actor).includes(permission))
    return {
      error: fail(403, "You do not have permission to perform this action.", {
        code: "permission_denied",
      }),
    }
  return { actor }
}

function openOrder(id: unknown) {
  const order = orders.find((o) => o.id === id)
  if (!order) return { error: fail(400, "This order no longer exists.") }
  if (order.status !== "open" && order.status !== "billed")
    return {
      error: fail(400, "This order is closed.", { code: "order_closed" }),
    }
  return { order }
}

/** A printed bill is out of date once the order changes (backend orders.services._unbill). */
function unbill(order: Order) {
  if (order.status !== "billed") return
  order.status = "open"
  order.billed_at = null
}

function approve(
  actor: MockStaff,
  permission: string,
  body: { approver?: number; approver_pin?: string },
  what: string
) {
  if (permissionsOf(actor).includes(permission)) return { by: actor }
  if (body.approver === undefined)
    return {
      error: fail(403, `A manager must approve this ${what}.`, {
        code: "approval_required",
      }),
    }
  const approver = staff.find((m) => m.id === body.approver && m.is_active)
  if (!approver || !permissionsOf(approver).includes(perm.approveOverride))
    return {
      error: fail(403, "This person cannot approve.", {
        code: "approval_rejected",
      }),
    }
  if (approver.pin !== body.approver_pin)
    return {
      error: fail(403, "PIN is incorrect.", { code: "approval_rejected" }),
    }
  return { by: approver }
}

function cashierJob(payload: TicketPayload) {
  const job = pushJob(payload)
  bus.emit("print", { type: "print.job", id: job.id, station: job.station })
}

function changed(order: Order) {
  recompute(order)
  bus.emit("orders", {
    type: "order.changed",
    id: order.id,
    version: order.version,
  })
  bus.emit("floor", { type: "floor.changed" })
  return ok(order)
}

function queue(
  order: Order,
  lines: OrderLine[],
  kind: TicketPayload["kind"],
  actor: MockStaff
) {
  const byStation = new Map<string, OrderLine[]>()
  for (const line of lines) {
    if (line.station === "none") continue
    byStation.set(line.station, [...(byStation.get(line.station) ?? []), line])
  }
  for (const [station, stationLines] of byStation) {
    const job: PrintJob = {
      id: mockId(),
      station,
      kind,
      status: "queued",
      payload: ticketPayload(
        order,
        stationLines,
        station,
        kind,
        actor.full_name
      ),
      attempts: 0,
      error: "",
      created_at: new Date().toISOString(),
      printed_at: null,
    }
    printJobs.push(job)
    bus.emit("print", { type: "print.job", id: job.id, station })
  }
}

type LineBody = {
  id: string
  product: string
  quantity?: number
  modifiers?: string[]
  note?: string
  seat?: number | null
}

function buildLine(
  body: LineBody,
  order: Order,
  actor: MockStaff
): OrderLine | string {
  const product = products.find((p) => p.id === body.product)
  if (!product || product.kind === "ingredient" || !product.is_active)
    return "This item is not for sale."
  if (!product.is_available) return `${product.name} is sold out.`
  const chosen = new Set(body.modifiers ?? [])
  const modifiers: OrderLine["modifiers"] = []
  for (const groupId of product.modifier_groups) {
    const group = modifierGroups.find((g) => g.id === groupId)
    if (!group) continue
    const picked = group.options.filter((o) => chosen.has(o.id))
    if (picked.length < group.min_select)
      return `${product.name}: choose ${group.name}.`
    if (picked.length > group.max_select)
      return `${product.name}: at most ${group.max_select} for ${group.name}.`
    for (const option of picked)
      modifiers.push({
        group: group.name,
        name: option.name,
        price_delta: option.price_delta,
      })
  }
  if (body.seat && (body.seat < 1 || body.seat > order.guests))
    return `Seat ${body.seat} is not at this table.`
  const unit = Math.max(
    0,
    product.price + modifiers.reduce((sum, m) => sum + m.price_delta, 0)
  )
  const quantity = body.quantity ?? 1
  return {
    id: body.id,
    product: product.id,
    name: product.name,
    unit_price: unit,
    quantity,
    modifiers,
    note: (body.note ?? "").trim(),
    seat: body.seat ?? null,
    station: stationOf(product.id),
    status: "held",
    total: unit * quantity,
    added_by_name: actor.full_name,
    sent_at: null,
    void_reason: "",
    tax_category: product.tax_category,
    paid: false,
  }
}

function send(order: Order, lines: OrderLine[], actor: MockStaff) {
  const now = new Date().toISOString()
  for (const line of lines)
    Object.assign(line, { status: "sent", sent_at: now })
  deductSale(order.number, lines, actor.full_name)
  queue(order, lines, "kitchen", actor)
}

const localDay = (iso: string) => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** backend orders.serializers.OrderSummarySerializer */
function summaryRow(order: Order) {
  const live = order.lines.filter((l) => l.status !== "void")
  const summary = live
    .slice(0, 3)
    .map((l) => `${l.quantity}× ${l.name}`)
    .join(", ")
  return {
    id: order.id,
    number: order.number,
    channel: order.channel,
    type: order.type,
    table_label: order.table_label,
    guests: order.guests,
    status: order.status,
    waiter: order.waiter,
    total: order.bill.total,
    paid: order.paid,
    items: live.reduce((sum, l) => sum + l.quantity, 0),
    summary: summary + (live.length > 3 ? ", …" : ""),
    promo_name: order.promo_name,
    created_at: order.created_at,
    closed_at: order.closed_at,
    refunded_at: order.refunded_at,
  }
}

export const orderHandlers = [
  // Before /orders/:id/, so "history" is not read as an order id.
  http.get(apiPath("/orders/history/"), async ({ request }) => {
    const actor = bearerStaff(request)
    if (!actor)
      return fail(401, "Authentication credentials were not provided.", {
        code: "not_authenticated",
      })
    if (!permissionsOf(actor).includes(perm.viewReports))
      return fail(403, "You do not have permission to perform this action.", {
        code: "permission_denied",
      })
    await delay(250)
    const url = new URL(request.url)
    const from =
      url.searchParams.get("from") ?? localDay(new Date().toISOString())
    const to = url.searchParams.get("to") ?? from
    const channel = url.searchParams.get("channel")
    const status = url.searchParams.get("status")
    const search = url.searchParams.get("search")?.trim().toLowerCase()
    const number = search?.replace(/^#/, "")
    const rows = orders
      .filter((o) => {
        if (o.status === "merged") return false
        const day = localDay(o.created_at)
        if (day < from || day > to) return false
        if (channel && o.channel !== channel) return false
        if (status === "open" && o.status !== "open" && o.status !== "billed")
          return false
        if (status && status !== "open" && o.status !== status) return false
        if (search)
          return (
            (number && /^\d+$/.test(number) && o.number === Number(number)) ||
            o.table_label.toLowerCase() === search ||
            o.waiter.toLowerCase().includes(search) ||
            o.lines.some((l) => l.name.toLowerCase().includes(search))
          )
        return true
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    const size = Number(url.searchParams.get("page_size") ?? 20)
    const page = Number(url.searchParams.get("page") ?? 1)
    return HttpResponse.json({
      success: true,
      count: rows.length,
      next: page * size < rows.length ? `?page=${page + 1}` : null,
      previous: page > 1 ? `?page=${page - 1}` : null,
      results: rows.slice((page - 1) * size, page * size).map(summaryRow),
    })
  }),

  http.post(apiPath("/orders/:id/refund/"), async ({ request, params }) => {
    const { actor, error } = actorWith(request, perm.takePayment)
    if (error) return error
    await delay(350)
    const order = orders.find((o) => o.id === params.id)
    if (!order) return fail(404, "Not found.")
    if (order.status !== "paid")
      return fail(400, "Only a paid order can be refunded.")
    const body = (await request.json()) as {
      reason?: string
      approver?: number
      approver_pin?: string
    }
    const reason = (body.reason ?? "").trim()
    if (!reason)
      return fail(400, "Say why it is refunded.", {
        errors: { reason: ["Say why it is refunded."] },
      })
    const approval = approve(actor, perm.voidSentItem, body, "refund")
    if (approval.error) return approval.error
    const shift = currentShift()
    if (!shift)
      return fail(400, "Open a shift first: cash goes into the drawer.", {
        code: "no_open_shift",
      })
    refreshTotals(shift)
    if (order.paid > shift.totals.expected_cash)
      return fail(
        400,
        "There isn't that much cash in the drawer for this refund."
      )
    shiftRefunds.push({ shift: shift.id, amount: order.paid })
    refreshTotals(shift)
    Object.assign(order, {
      status: "refunded",
      refunded_at: new Date().toISOString(),
      refund_reason: reason,
      refunded_by_name: actor.full_name,
      refund_approved_by_name: approval.by.full_name,
    })
    returnRefund(order, actor.full_name)
    const slip = billPayload(order, "receipt", actor.full_name, null)
    slip.refund = { amount: order.paid, reason }
    cashierJob(slip)
    audit("order.refund", actor, `#${order.number}`, {
      amount: order.paid,
      reason,
      approved_by: approval.by.full_name,
    })
    return changed(order)
  }),

  http.post(apiPath("/orders/:id/reprint/"), async ({ request, params }) => {
    const { actor, error } = actorWith(request, perm.reprint)
    if (error) return error
    await delay()
    const order = orders.find((o) => o.id === params.id)
    if (!order) return fail(404, "Not found.")
    const { kind } = (await request.json()) as { kind: "bill" | "receipt" }
    if (kind === "receipt" && order.payments.length === 0)
      return fail(400, "This order has no payment to print a receipt for.", {
        errors: { kind: ["This order has no payment to print a receipt for."] },
      })
    const payload = billPayload(
      order,
      kind,
      actor.full_name,
      kind === "receipt" ? (order.payments.at(-1) ?? null) : null
    )
    payload.reprint = true
    if (kind === "receipt" && order.status === "refunded")
      payload.refund = { amount: order.paid, reason: order.refund_reason }
    cashierJob(payload)
    return HttpResponse.json({ success: true }, { status: 201 })
  }),

  http.get(apiPath("/auth/approvers/"), ({ request }) => {
    if (!bearerStaff(request))
      return fail(401, "Authentication credentials were not provided.", {
        code: "not_authenticated",
      })
    return ok(
      staff
        .filter(
          (m) =>
            m.is_active &&
            m.pin &&
            permissionsOf(m).includes(perm.approveOverride)
        )
        .map((m) => ({ id: m.id, full_name: m.full_name }))
    )
  }),

  http.get(apiPath("/orders/"), async ({ request }) => {
    const { error } = actorWith(request, perm.takeOrder)
    if (error) return error
    await delay()
    return ok(
      orders.filter((o) => o.status === "open" || o.status === "billed")
    )
  }),

  http.get(apiPath("/orders/:id/"), async ({ request, params }) => {
    const { error } = actorWith(request, perm.takeOrder)
    if (error) return error
    await delay()
    const order = orders.find((o) => o.id === params.id)
    return order ? ok(order) : fail(404, "Not found.")
  }),

  http.post(apiPath("/orders/"), async ({ request }) => {
    const { actor, error } = actorWith(request, perm.takeOrder)
    if (error) return error
    await delay()
    const body = (await request.json()) as {
      id: string
      table: string | null
      guests?: number
      type?: Order["type"]
    }
    const existing = orders.find((o) => o.id === body.id)
    if (existing) return ok(existing, { status: 201 })
    const table = findTable(body.table)
    if (body.table && !table)
      return fail(400, "Invalid table.", {
        errors: { table: ["Invalid table."] },
      })
    if (
      table &&
      orders.some(
        (o) =>
          o.table === table.id && (o.status === "open" || o.status === "billed")
      )
    )
      return fail(400, `Table ${table.label} already has an open order.`, {
        errors: { table: [`Table ${table.label} already has an open order.`] },
      })
    if (table) table.status = "available"
    const order = blankOrder({
      id: body.id,
      type: body.type ?? "dine_in",
      table: table?.id ?? null,
      table_label: table?.label ?? "",
      guests: body.guests ?? 1,
      waiter: actor.full_name,
      created_at: new Date().toISOString(),
    })
    orders.push(order)
    changed(order)
    return HttpResponse.json({ success: true, data: order }, { status: 201 })
  }),

  http.post(apiPath("/orders/:id/lines/"), async ({ request, params }) => {
    const { actor, error } = actorWith(request, perm.takeOrder)
    if (error) return error
    await delay()
    const found = openOrder(params.id)
    if (found.error) return found.error
    const order = found.order
    const body = (await request.json()) as { lines: LineBody[]; send?: boolean }
    const created: OrderLine[] = []
    for (const lineBody of body.lines) {
      if (order.lines.some((line) => line.id === lineBody.id)) continue
      const line = buildLine(lineBody, order, actor)
      if (typeof line === "string")
        return fail(400, line, { errors: { lines: [line] } })
      created.push(line)
    }
    order.lines.push(...created)
    if (created.length) unbill(order)
    if (body.send !== false && created.length) send(order, created, actor)
    return changed(order)
  }),

  http.post(apiPath("/orders/:id/send/"), async ({ request, params }) => {
    const { actor, error } = actorWith(request, perm.takeOrder)
    if (error) return error
    await delay()
    const found = openOrder(params.id)
    if (found.error) return found.error
    const { line_ids } = (await request.json()) as {
      line_ids?: string[] | null
    }
    const held = found.order.lines.filter(
      (l) => l.status === "held" && (!line_ids || line_ids.includes(l.id))
    )
    if (!held.length) return fail(400, "Nothing is waiting to be sent.")
    unbill(found.order)
    send(found.order, held, actor)
    return changed(found.order)
  }),

  http.patch(
    apiPath("/orders/:id/lines/:lineId/"),
    async ({ request, params }) => {
      const { error } = actorWith(request, perm.takeOrder)
      if (error) return error
      await delay()
      const found = openOrder(params.id)
      if (found.error) return found.error
      const line = found.order.lines.find((l) => l.id === params.lineId)
      if (!line) return fail(400, "This line no longer exists.")
      if (line.status !== "held")
        return fail(400, "Sent items can only be voided.")
      const body = (await request.json()) as {
        quantity?: number
        note?: string
      }
      if (body.quantity) line.quantity = body.quantity
      if (body.note !== undefined) line.note = body.note.trim()
      line.total = line.unit_price * line.quantity
      unbill(found.order)
      return changed(found.order)
    }
  ),

  http.post(
    apiPath("/orders/:id/lines/:lineId/void/"),
    async ({ request, params }) => {
      const { actor, error } = actorWith(request, perm.takeOrder)
      if (error) return error
      await delay()
      const found = openOrder(params.id)
      if (found.error) return found.error
      const order = found.order
      const line = order.lines.find((l) => l.id === params.lineId)
      if (!line || line.status === "void")
        return fail(400, "This line is already gone.")
      if (line.paid) return fail(400, "This item is already paid.")
      unbill(order)
      if (line.status === "held") {
        order.lines.splice(order.lines.indexOf(line), 1)
        return changed(order)
      }
      const body = (await request.json()) as {
        reason?: string
        approver?: number
        approver_pin?: string
      }
      if (!body.reason?.trim())
        return fail(400, "Say why it is voided.", {
          errors: { reason: ["Say why it is voided."] },
        })
      const approval = approve(actor, perm.voidSentItem, body, "void")
      if (approval.error) return approval.error
      Object.assign(line, { status: "void", void_reason: body.reason.trim() })
      returnVoid(order.number, line, actor.full_name)
      audit(
        "order.void_item",
        actor,
        `#${order.number} · ${line.quantity}× ${line.name}`,
        {
          amount: line.total,
          reason: line.void_reason,
        }
      )
      queue(order, [line], "void", actor)
      return changed(order)
    }
  ),

  http.post(apiPath("/orders/:id/move/"), async ({ request, params }) => {
    const { error } = actorWith(request, perm.takeOrder)
    if (error) return error
    await delay()
    const found = openOrder(params.id)
    if (found.error) return found.error
    const { table: tableId } = (await request.json()) as { table: string }
    const table = findTable(tableId)
    if (!table) return fail(400, "Invalid table.")
    if (
      orders.some(
        (o) =>
          o !== found.order &&
          o.table === table.id &&
          (o.status === "open" || o.status === "billed")
      )
    )
      return fail(400, `Table ${table.label} already has an open order.`, {
        errors: { table: [`Table ${table.label} already has an open order.`] },
      })
    const previous = findTable(found.order.table)
    if (previous && previous !== table) previous.status = "cleaning"
    Object.assign(found.order, { table: table.id, table_label: table.label })
    return changed(found.order)
  }),

  http.post(apiPath("/orders/:id/merge/"), async ({ request, params }) => {
    const { error } = actorWith(request, perm.takeOrder)
    if (error) return error
    await delay()
    const target = openOrder(params.id)
    if (target.error) return target.error
    const { source: sourceId } = (await request.json()) as { source: string }
    if (sourceId === params.id) return fail(400, "Pick another table to merge.")
    const source = openOrder(sourceId)
    if (source.error) return source.error
    unbill(target.order)
    target.order.lines.push(...source.order.lines)
    source.order.lines = []
    target.order.guests += source.order.guests
    source.order.status = "merged"
    const table = findTable(source.order.table)
    if (table) table.status = "cleaning"
    changed(source.order)
    return changed(target.order)
  }),

  http.post(apiPath("/orders/:id/guests/"), async ({ request, params }) => {
    const { error } = actorWith(request, perm.takeOrder)
    if (error) return error
    const found = openOrder(params.id)
    if (found.error) return found.error
    const { guests } = (await request.json()) as { guests: number }
    found.order.guests = guests
    return changed(found.order)
  }),

  http.post(apiPath("/orders/:id/cancel/"), async ({ request, params }) => {
    const { error } = actorWith(request, perm.takeOrder)
    if (error) return error
    await delay()
    const found = openOrder(params.id)
    if (found.error) return found.error
    if (found.order.lines.some((l) => l.status === "sent"))
      return fail(400, "Void the sent items first.")
    found.order.lines = []
    found.order.status = "void"
    return changed(found.order)
  }),

  // --- Checkout ---------------------------------------------------------------
  http.post(apiPath("/orders/:id/discount/"), async ({ request, params }) => {
    const { actor, error } = actorWith(request, perm.takeOrder)
    if (error) return error
    await delay()
    const found = openOrder(params.id)
    if (found.error) return found.error
    const order = found.order
    const body = (await request.json()) as {
      kind: Order["discount_kind"]
      value?: number
      reason?: string
      approver?: number
      approver_pin?: string
    }
    const value = body.value ?? 0
    const reason = (body.reason ?? "").trim()
    if (body.kind !== "none") {
      if (body.kind === "percent" && !(value > 0 && value <= 100))
        return fail(400, "A percent discount is 1 to 100.", {
          errors: { value: ["A percent discount is 1 to 100."] },
        })
      if (body.kind === "amount" && value <= 0)
        return fail(400, "Enter an amount.", {
          errors: { value: ["Enter an amount."] },
        })
      if (!reason)
        return fail(400, "Say why.", { errors: { reason: ["Say why."] } })
      if (order.payments.length)
        return fail(
          400,
          "Part of this bill is paid; the discount can no longer change."
        )
    }
    const approval = approve(actor, perm.applyDiscount, body, "discount")
    if (approval.error) return approval.error
    audit("order.discount", actor, `#${order.number}`, {
      kind: body.kind,
      value,
      reason,
      approved_by: approval.by.full_name,
    })
    // One discount per bill: a manual discount replaces a promo.
    if (body.kind !== "none")
      Object.assign(order, { promo: null, promo_name: "" })
    Object.assign(order, {
      discount_kind: body.kind,
      discount_value: body.kind === "none" ? 0 : value,
      discount_reason: body.kind === "none" ? "" : reason,
    })
    unbill(order)
    return changed(order)
  }),

  http.get(apiPath("/orders/:id/promos/"), async ({ request, params }) => {
    const { error } = actorWith(request, perm.takePayment)
    if (error) return error
    await delay()
    const order = orders.find((o) => o.id === params.id)
    if (!order) return fail(404, "Not found.")
    const lines = order.lines.filter((l) => l.status !== "void")
    const subtotal = lines.reduce((sum, l) => sum + l.total, 0)
    const rows = promos.flatMap((promo) => {
      let reason: string | null = unavailableReason(promo, order.channel)
      if (
        reason &&
        ["inactive", "channel", "not_started", "ended"].includes(reason)
      )
        return []
      const saving = reason === null ? promoDiscount(promo, lines) : 0
      if (reason === null && saving <= 0)
        reason = subtotal < promo.min_spend ? "min_spend" : "no_items"
      return [
        {
          ...promo,
          saving,
          unavailable: reason,
          applied: order.promo === promo.id,
        },
      ]
    })
    rows.sort(
      (a, b) =>
        Number(a.unavailable !== null) - Number(b.unavailable !== null) ||
        b.saving - a.saving
    )
    return ok(rows)
  }),

  http.post(apiPath("/orders/:id/promo/"), async ({ request, params }) => {
    const { actor, error } = actorWith(request, perm.takePayment)
    if (error) return error
    await delay()
    const found = openOrder(params.id)
    if (found.error) return found.error
    const order = found.order
    if (order.payments.length)
      return fail(
        400,
        "Part of this bill is paid; the discount can no longer change."
      )
    const { promo: promoId } = (await request.json()) as {
      promo: string | null
    }
    const promo = promoId ? promos.find((p) => p.id === promoId) : null
    if (promoId && !promo) return fail(400, "Invalid promo.")
    if (promo) {
      const reason = unavailableReason(promo, order.channel)
      if (reason)
        return fail(400, `This promo isn't available now (${reason}).`, {
          errors: { promo: [`This promo isn't available now (${reason}).`] },
        })
      if (
        promoDiscount(
          promo,
          order.lines.filter((l) => l.status !== "void")
        ) <= 0
      )
        return fail(400, "This bill doesn't qualify for the promo.", {
          errors: { promo: ["This bill doesn't qualify for the promo."] },
        })
      Object.assign(order, {
        discount_kind: "none",
        discount_value: 0,
        discount_reason: "",
      })
    }
    Object.assign(order, {
      promo: promo?.id ?? null,
      promo_name: promo?.name ?? "",
    })
    unbill(order)
    audit("order.promo", actor, `#${order.number}`, {
      promo: promo?.name ?? null,
    })
    return changed(order)
  }),

  http.post(apiPath("/orders/:id/bill/"), async ({ request, params }) => {
    const { actor, error } = actorWith(request, perm.takePayment)
    if (error) return error
    await delay()
    const found = openOrder(params.id)
    if (found.error) return found.error
    const order = found.order
    if (!order.lines.some((l) => l.status !== "void"))
      return fail(400, "There is nothing on this bill yet.")
    if (order.lines.some((l) => l.status === "held"))
      return fail(400, "Send or remove held items before printing the bill.")
    order.status = "billed"
    order.billed_at = new Date().toISOString()
    recompute(order)
    cashierJob(billPayload(order, "bill", actor.full_name))
    return changed(order)
  }),

  http.post(apiPath("/orders/:id/payments/"), async ({ request, params }) => {
    const { actor, error } = actorWith(request, perm.takePayment)
    if (error) return error
    await delay(400)
    const body = (await request.json()) as {
      id: string
      method?: string
      tendered: number
      amount?: number
      line_ids?: string[]
    }
    const retried = orders.find((o) => o.payments.some((p) => p.id === body.id))
    if (retried) return ok(retried, { status: 201 })
    const found = openOrder(params.id)
    if (found.error) return found.error
    const order = found.order
    if (order.lines.some((l) => l.status === "held"))
      return fail(400, "Send or remove held items before taking payment.")
    const shift = currentShift()
    if (!shift)
      return fail(400, "Open a shift first: cash goes into the drawer.", {
        code: "no_open_shift",
      })
    recompute(order)
    const remaining = order.bill.total - order.paid
    if (remaining <= 0) return fail(400, "This bill is already paid.")

    let due = remaining
    let lines: OrderLine[] = []
    if (body.line_ids?.length) {
      lines = order.lines.filter(
        (l) => body.line_ids!.includes(l.id) && !l.paid && l.status !== "void"
      )
      if (lines.length !== new Set(body.line_ids).size)
        return fail(
          400,
          "Some items are already paid or no longer on the bill.",
          {
            errors: {
              line_ids: [
                "Some items are already paid or no longer on the bill.",
              ],
            },
          }
        )
      const unpaidLeft = order.lines.some(
        (l) => !l.paid && l.status !== "void" && !lines.includes(l)
      )
      due = unpaidLeft
        ? Math.min(linesBill(order, lines).total, remaining)
        : remaining
    } else if (body.amount !== undefined) {
      if (!(body.amount > 0 && body.amount <= remaining))
        return fail(400, "More than what is left on the bill.", {
          errors: { amount: ["More than what is left on the bill."] },
        })
      due = body.amount
    }
    if (body.tendered < due)
      return fail(400, "Not enough cash.", {
        errors: { tendered: ["Not enough cash."] },
      })

    const payment = {
      id: body.id,
      method: "cash",
      amount: due,
      tendered: body.tendered,
      change: body.tendered - due,
      received_by_name: actor.full_name,
      created_at: new Date().toISOString(),
    }
    order.payments.push(payment)
    for (const line of lines) line.paid = true
    shiftPayments.push({ shift: shift.id, method: "cash", amount: due })
    refreshTotals(shift)
    recompute(order)
    if (order.paid >= order.bill.total) {
      order.status = "paid"
      order.closed_at = new Date().toISOString()
      const table = findTable(order.table)
      if (table) table.status = "cleaning"
    }
    cashierJob(billPayload(order, "receipt", actor.full_name, payment))
    audit("order.payment", actor, `#${order.number}`, {
      amount: due,
      method: "cash",
    })
    changed(order)
    return ok(order, { status: 201 })
  }),

  // --- Snack bar counter -------------------------------------------------------
  http.get(apiPath("/sales/"), async ({ request }) => {
    const { error } = actorWith(request, perm.takePayment)
    if (error) return error
    await delay()
    const today = new Date().toDateString()
    return ok(
      orders
        .filter(
          (o) =>
            o.channel === "snackbar" &&
            o.status === "paid" &&
            new Date(o.payments.at(-1)?.created_at ?? 0).toDateString() ===
              today
        )
        .reverse()
        .slice(0, 30)
    )
  }),

  http.post(apiPath("/sales/"), async ({ request }) => {
    const { actor, error } = actorWith(request, perm.takePayment)
    if (error) return error
    await delay(350)
    const body = (await request.json()) as {
      id: string
      tendered: number
      lines: LineBody[]
    }
    const existing = orders.find((o) => o.id === body.id)
    if (existing) return ok(existing, { status: 201 })
    const shift = currentShift()
    if (!shift)
      return fail(400, "Open a shift first: cash goes into the drawer.", {
        code: "no_open_shift",
      })
    // Built aside and only kept once the cash is enough, like the API's transaction.
    const order = blankOrder({
      id: body.id,
      channel: "snackbar",
      type: "takeaway",
      table: null,
      table_label: "",
      guests: 1,
      waiter: actor.full_name,
      created_at: new Date().toISOString(),
    })
    for (const lineBody of body.lines) {
      const line = buildLine(lineBody, order, actor)
      if (typeof line === "string")
        return fail(400, line, { errors: { lines: [line] } })
      order.lines.push(line)
    }
    recompute(order)
    const due = order.bill.total
    if (body.tendered < due)
      return fail(400, "Not enough cash.", {
        errors: { tendered: ["Not enough cash."] },
      })
    orders.push(order)
    send(order, order.lines, actor)
    const payment = {
      id: mockId(),
      method: "cash",
      amount: due,
      tendered: body.tendered,
      change: body.tendered - due,
      received_by_name: actor.full_name,
      created_at: new Date().toISOString(),
    }
    order.payments.push(payment)
    order.status = "paid"
    order.closed_at = payment.created_at
    shiftPayments.push({ shift: shift.id, method: "cash", amount: due })
    refreshTotals(shift)
    recompute(order)
    cashierJob(billPayload(order, "receipt", actor.full_name, payment))
    audit("order.sale", actor, `#${order.number}`, {
      amount: due,
      method: "cash",
    })
    changed(order)
    return ok(order, { status: 201 })
  }),

  // --- Print jobs -------------------------------------------------------------
  http.get(apiPath("/printing/jobs/"), async ({ request }) => {
    const { error } = actorWith(request, perm.printStation)
    if (error) return error
    await delay()
    const url = new URL(request.url)
    const stations = url.searchParams.get("station")?.split(",").filter(Boolean)
    const statuses = url.searchParams.get("status")?.split(",").filter(Boolean)
    return ok(
      printJobs
        .filter(
          (job) =>
            (!stations || stations.includes(job.station)) &&
            (!statuses || statuses.includes(job.status))
        )
        .slice(-100)
    )
  }),

  http.post(apiPath("/printing/jobs/:id/ack/"), async ({ request, params }) => {
    const { error } = actorWith(request, perm.printStation)
    if (error) return error
    const job = printJobs.find((j) => j.id === params.id)
    if (!job) return fail(404, "Not found.")
    const body = (await request.json()) as {
      status: "printed" | "failed"
      error?: string
    }
    Object.assign(job, {
      status: body.status,
      error: body.error ?? "",
      attempts: job.attempts + 1,
      printed_at: body.status === "printed" ? new Date().toISOString() : null,
    })
    bus.emit("print", { type: "print.ack", id: job.id, status: job.status })
    return ok(job)
  }),

  http.post(
    apiPath("/printing/jobs/:id/reprint/"),
    async ({ request, params }) => {
      const { actor, error } = actorWith(request, perm.reprint)
      if (error) return error
      const original = printJobs.find((j) => j.id === params.id)
      if (!original) return fail(404, "Not found.")
      const job: PrintJob = {
        ...original,
        id: mockId(),
        status: "queued",
        attempts: 0,
        error: "",
        printed_at: null,
        created_at: new Date().toISOString(),
        payload: { ...original.payload, reprint: true, by: actor.full_name },
      }
      printJobs.push(job)
      bus.emit("print", { type: "print.job", id: job.id, station: job.station })
      return ok(job, { status: 201 })
    }
  ),

  http.post(apiPath("/printing/jobs/test/"), async ({ request }) => {
    const { actor, error } = actorWith(request, perm.printStation)
    if (error) return error
    const { station } = (await request.json()) as { station: string }
    const job: PrintJob = {
      id: mockId(),
      station,
      kind: "test",
      status: "queued",
      payload: {
        kind: "test",
        station,
        by: actor.full_name,
        at: new Date().toISOString(),
        lines: [],
      },
      attempts: 0,
      error: "",
      created_at: new Date().toISOString(),
      printed_at: null,
    }
    printJobs.push(job)
    bus.emit("print", { type: "print.job", id: job.id, station })
    return ok(job, { status: 201 })
  }),
]
