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
import {
  currentShift,
  refreshTotals,
  shiftPayments,
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
    paid: false,
  }
}

function send(order: Order, lines: OrderLine[], actor: MockStaff) {
  const now = new Date().toISOString()
  for (const line of lines)
    Object.assign(line, { status: "sent", sent_at: now })
  queue(order, lines, "kitchen", actor)
}

export const orderHandlers = [
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
    Object.assign(order, {
      discount_kind: body.kind,
      discount_value: body.kind === "none" ? 0 : value,
      discount_reason: body.kind === "none" ? "" : reason,
    })
    unbill(order)
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
      const table = findTable(order.table)
      if (table) table.status = "cleaning"
    }
    cashierJob(billPayload(order, "receipt", actor.full_name, payment))
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
