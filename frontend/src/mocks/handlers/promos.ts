import { delay, http } from "msw"

import { perm } from "@/features/auth/lib/permissions.ts"
import type { Promo } from "@/features/promos/schemas/promo.ts"
import { mockId } from "@/mocks/db/catalog.ts"
import { promos } from "@/mocks/db/promos.ts"
import { permissionsOf } from "@/mocks/db/staff.ts"
import { bearerStaff } from "@/mocks/handlers/auth.ts"
import { apiPath, fail, ok } from "@/mocks/http.ts"

function allowed(request: Request) {
  const actor = bearerStaff(request)
  if (!actor)
    return fail(401, "Authentication credentials were not provided.", {
      code: "not_authenticated",
    })
  if (!permissionsOf(actor).includes(perm.managePromos))
    return fail(403, "You do not have permission to perform this action.", {
      code: "permission_denied",
    })
  return null
}

/** backend promos.serializers.PromoSerializer.validate */
function invalid(promo: Promo) {
  const errors: Record<string, string[]> = {}
  if (!promo.name.trim()) errors.name = ["Name it."]
  if (promo.kind === "bundle") {
    if (!promo.buy_quantity) errors.buy_quantity = ["How many must they buy?"]
    if (!promo.get_quantity) errors.get_quantity = ["How many do they get?"]
  }
  if (promo.kind === "bill" && promo.benefit === "price")
    errors.benefit = ["A promo price applies to items, not the whole bill."]
  if (promo.benefit === "percent" && !(promo.value >= 1 && promo.value <= 100))
    errors.value = ["A percent is 1 to 100."]
  if (promo.benefit !== "percent" && !promo.value)
    errors.value = ["Enter an amount."]
  if (
    promo.kind !== "bill" &&
    promo.products.length === 0 &&
    promo.categories.length === 0
  )
    errors.products = ["Pick the items or categories it covers."]
  if (promo.starts_on && promo.ends_on && promo.ends_on < promo.starts_on)
    errors.ends_on = ["Ends before it starts."]
  if (Boolean(promo.starts_at) !== Boolean(promo.ends_at))
    errors.ends_at = ["Set both times, or neither."]
  const first = Object.values(errors)[0]?.[0]
  return first ? fail(400, first, { errors }) : null
}

function normalise(promo: Promo): Promo {
  return {
    ...promo,
    benefit: promo.kind === "bundle" ? "percent" : promo.benefit,
    weekdays: [...new Set(promo.weekdays)].sort((a, b) => a - b),
  }
}

export const promoHandlers = [
  http.get(apiPath("/promos/"), async ({ request }) => {
    const denied = allowed(request)
    if (denied) return denied
    await delay()
    return ok(
      [...promos].sort(
        (a, b) =>
          Number(b.is_active) - Number(a.is_active) ||
          a.name.localeCompare(b.name)
      )
    )
  }),

  http.post(apiPath("/promos/"), async ({ request }) => {
    const denied = allowed(request)
    if (denied) return denied
    await delay()
    const body = (await request.json()) as Omit<
      Promo,
      "id" | "image_url" | "created_at"
    >
    const promo = normalise({
      ...body,
      id: mockId(),
      image_url: null,
      created_at: new Date().toISOString(),
    })
    const error = invalid(promo)
    if (error) return error
    promos.push(promo)
    return ok(promo, { status: 201 })
  }),

  http.patch(apiPath("/promos/:id/"), async ({ request, params }) => {
    const denied = allowed(request)
    if (denied) return denied
    await delay()
    const index = promos.findIndex((p) => p.id === params.id)
    if (index === -1) return fail(404, "Not found.")
    const body = (await request.json()) as Partial<Promo>
    const promo = normalise({ ...promos[index]!, ...body })
    const error = invalid(promo)
    if (error) return error
    promos[index] = promo
    return ok(promo)
  }),

  http.post(apiPath("/promos/:id/image/"), async ({ request, params }) => {
    const denied = allowed(request)
    if (denied) return denied
    await delay()
    const promo = promos.find((p) => p.id === params.id)
    if (!promo) return fail(404, "Not found.")
    const file = (await request.formData()).get("image")
    if (!(file instanceof File) || !file.type.startsWith("image/"))
      return fail(400, "Upload a JPG, PNG, or WebP image.", {
        errors: { image: ["Upload a JPG, PNG, or WebP image."] },
      })
    // The browser holds the file for this session, standing in for storage.
    promo.image_url = URL.createObjectURL(file)
    return ok(promo)
  }),
]
