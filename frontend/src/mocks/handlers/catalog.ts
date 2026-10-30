import { delay, http } from "msw"

import { perm } from "@/features/auth/lib/permissions.ts"
import type { Product } from "@/features/catalog/schemas/catalog.ts"
import {
  categories,
  groupProductCount,
  mockId,
  modifierGroups,
  productCount,
  products,
} from "@/mocks/db/catalog.ts"
import { permissionsOf } from "@/mocks/db/staff.ts"
import { bearerStaff } from "@/mocks/handlers/auth.ts"
import { apiPath, fail, ok } from "@/mocks/http.ts"

function guard(request: Request, write: boolean) {
  const actor = bearerStaff(request)
  if (!actor)
    return fail(401, "Authentication credentials were not provided.", {
      code: "not_authenticated",
    })
  if (write && !permissionsOf(actor).includes(perm.manageSettings))
    return fail(403, "You do not have permission to perform this action.", {
      code: "permission_denied",
    })
  return null
}

function invalid(errors: Record<string, string[]>) {
  return fail(400, Object.values(errors)[0]?.[0] ?? "Invalid input.", {
    errors,
  })
}

const categoryRow = (c: (typeof categories)[number]) => ({
  ...c,
  product_count: productCount(c.id),
})
const groupRow = (g: (typeof modifierGroups)[number]) => ({
  ...g,
  product_count: groupProductCount(g.id),
})

function sorted<T extends { sort_order: number; name: string }>(rows: T[]) {
  return [...rows].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  )
}

type ProductBody = Partial<Omit<Product, "recipe">> & {
  recipe?: { ingredient: string; quantity: number }[]
}

function applyProduct(target: Product, body: ProductBody) {
  const errors: Record<string, string[]> = {}
  const kind = body.kind ?? target.kind
  const category = body.category === undefined ? target.category : body.category
  if (body.name !== undefined && !body.name.trim())
    errors.name = ["This field may not be blank."]
  if (kind !== "ingredient" && !category) errors.category = ["Pick a category."]
  const barcode =
    body.barcode === undefined ? target.barcode : body.barcode?.trim() || null
  const clash =
    barcode && products.find((p) => p.barcode === barcode && p.id !== target.id)
  if (clash) errors.barcode = [`${clash.name} already uses this barcode.`]
  const lines = body.recipe?.map((line) => ({
    line,
    ingredient: products.find(
      (p) => p.id === line.ingredient && p.kind === "ingredient"
    ),
  }))
  if (lines?.some((entry) => !entry.ingredient))
    errors.recipe = ["Pick an ingredient for every line."]
  if (Object.keys(errors).length) return errors

  Object.assign(target, body, {
    kind,
    barcode,
    category: kind === "ingredient" ? null : category,
  })
  target.category_name =
    categories.find((c) => c.id === target.category)?.name ?? null
  if (kind === "ingredient")
    Object.assign(target, {
      price: 0,
      tax_category: "none",
      modifier_groups: [],
    })
  if (lines) {
    target.recipe = lines.map(({ line, ingredient }) => ({
      ingredient: ingredient!.id,
      ingredient_name: ingredient!.name,
      unit: ingredient!.unit,
      quantity: line.quantity,
      cost: Math.round(ingredient!.cost * line.quantity),
    }))
  }
  target.recipe_cost = target.recipe.length
    ? target.recipe.reduce((sum, line) => sum + line.cost, 0)
    : null
  return null
}

export const catalogHandlers = [
  // --- Categories ----------------------------------------------------------
  http.get(apiPath("/catalog/categories/"), async ({ request }) => {
    const error = guard(request, false)
    if (error) return error
    await delay()
    return ok(sorted(categories).map(categoryRow))
  }),

  http.post(apiPath("/catalog/categories/reorder/"), async ({ request }) => {
    const error = guard(request, true)
    if (error) return error
    await delay()
    const { ids } = (await request.json()) as { ids: string[] }
    ids.forEach((id, index) => {
      const row = categories.find((c) => c.id === id)
      if (row) row.sort_order = index
    })
    return ok(sorted(categories).map(categoryRow))
  }),

  http.post(apiPath("/catalog/categories/"), async ({ request }) => {
    const error = guard(request, true)
    if (error) return error
    await delay()
    const body = (await request.json()) as Partial<(typeof categories)[number]>
    if (!body.name?.trim())
      return invalid({ name: ["This field may not be blank."] })
    if (
      categories.some(
        (c) => c.name.toLowerCase() === body.name!.trim().toLowerCase()
      )
    )
      return invalid({ name: ["Another category has this name."] })
    const row = {
      id: mockId(),
      name: body.name.trim(),
      station: body.station ?? "kitchen",
      sort_order: categories.length,
      is_active: body.is_active ?? true,
    }
    categories.push(row)
    return ok(categoryRow(row), { status: 201 })
  }),

  http.patch(
    apiPath("/catalog/categories/:id/"),
    async ({ request, params }) => {
      const error = guard(request, true)
      if (error) return error
      await delay()
      const row = categories.find((c) => c.id === params.id)
      if (!row) return fail(404, "Not found.")
      const body = (await request.json()) as Partial<typeof row>
      if (
        body.name !== undefined &&
        categories.some(
          (c) =>
            c !== row &&
            c.name.toLowerCase() === body.name!.trim().toLowerCase()
        )
      )
        return invalid({ name: ["Another category has this name."] })
      Object.assign(row, body)
      for (const product of products)
        if (product.category === row.id) product.category_name = row.name
      return ok(categoryRow(row))
    }
  ),

  http.delete(
    apiPath("/catalog/categories/:id/"),
    async ({ request, params }) => {
      const error = guard(request, true)
      if (error) return error
      await delay()
      const index = categories.findIndex((c) => c.id === params.id)
      if (index < 0) return fail(404, "Not found.")
      if (products.some((p) => p.category === params.id))
        return fail(
          400,
          "It is still in use. Move or remove what uses it first."
        )
      categories.splice(index, 1)
      return ok(undefined)
    }
  ),

  // --- Products --------------------------------------------------------------
  http.get(apiPath("/catalog/products/"), async ({ request }) => {
    const error = guard(request, false)
    if (error) return error
    await delay()
    const url = new URL(request.url)
    const kinds = url.searchParams.get("kind")?.split(",")
    const barcode = url.searchParams.get("barcode")
    const search = url.searchParams.get("search")?.trim().toLowerCase()
    const active = url.searchParams.get("active") ?? "true"
    return ok(
      sorted(
        products.filter(
          (p) =>
            (!kinds || kinds.includes(p.kind)) &&
            (!barcode || p.barcode === barcode) &&
            (!search ||
              p.name.toLowerCase().includes(search) ||
              p.barcode === search ||
              p.sku.toLowerCase() === search) &&
            (active === "all" || String(p.is_active) === active)
        )
      )
    )
  }),

  http.post(apiPath("/catalog/products/"), async ({ request }) => {
    const error = guard(request, true)
    if (error) return error
    await delay()
    const body = (await request.json()) as ProductBody
    const row: Product = {
      id: mockId(),
      kind: body.kind ?? "menu",
      name: "",
      description: "",
      category: null,
      category_name: null,
      price: 0,
      cost: 0,
      unit: "portion",
      barcode: null,
      sku: "",
      tax_category: "pbjt",
      track_stock: false,
      low_stock_threshold: null,
      image_url: null,
      is_available: true,
      is_favorite: false,
      is_active: true,
      sort_order: products.length,
      modifier_groups: [],
      recipe: [],
      recipe_cost: null,
    }
    const errors = applyProduct(row, { name: "", ...body })
    if (errors) return invalid(errors)
    products.push(row)
    return ok(row, { status: 201 })
  }),

  http.patch(apiPath("/catalog/products/:id/"), async ({ request, params }) => {
    const error = guard(request, true)
    if (error) return error
    await delay()
    const row = products.find((p) => p.id === params.id)
    if (!row) return fail(404, "Not found.")
    const errors = applyProduct(row, (await request.json()) as ProductBody)
    if (errors) return invalid(errors)
    return ok(row)
  }),

  http.delete(
    apiPath("/catalog/products/:id/"),
    async ({ request, params }) => {
      const error = guard(request, true)
      if (error) return error
      await delay()
      const row = products.find((p) => p.id === params.id)
      if (!row) return fail(404, "Not found.")
      row.is_active = false
      return ok(undefined)
    }
  ),

  http.post(
    apiPath("/catalog/products/:id/image/"),
    async ({ request, params }) => {
      const error = guard(request, true)
      if (error) return error
      await delay()
      const row = products.find((p) => p.id === params.id)
      if (!row) return fail(404, "Not found.")
      const file = (await request.formData()).get("image")
      if (!(file instanceof File) || !file.type.startsWith("image/"))
        return invalid({ image: ["Upload a JPG, PNG, or WebP image."] })
      if (file.size > 10 * 1024 * 1024)
        return invalid({ image: ["The image must be 10 MB or smaller."] })
      // The browser holds the file for this session, standing in for storage.
      row.image_url = URL.createObjectURL(file)
      return ok(row)
    }
  ),

  // --- Modifier groups -----------------------------------------------------------
  http.get(apiPath("/catalog/modifier-groups/"), async ({ request }) => {
    const error = guard(request, false)
    if (error) return error
    await delay()
    return ok(sorted(modifierGroups).map(groupRow))
  }),

  http.post(apiPath("/catalog/modifier-groups/"), async ({ request }) => {
    const error = guard(request, true)
    if (error) return error
    await delay()
    const body = (await request.json()) as {
      name: string
      min_select: number
      max_select: number
      options: { name: string; price_delta: number }[]
    }
    if (body.min_select > body.max_select)
      return invalid({
        min_select: ["The minimum cannot be above the maximum."],
      })
    if (!body.options?.length)
      return invalid({ options: ["Add at least one option."] })
    const row = {
      id: mockId(),
      name: body.name.trim(),
      min_select: body.min_select,
      max_select: body.max_select,
      sort_order: modifierGroups.length,
      options: body.options.map((option, index) => ({
        id: mockId(),
        name: option.name,
        price_delta: option.price_delta,
        sort_order: index,
      })),
    }
    modifierGroups.push(row)
    return ok(groupRow(row), { status: 201 })
  }),

  http.patch(
    apiPath("/catalog/modifier-groups/:id/"),
    async ({ request, params }) => {
      const error = guard(request, true)
      if (error) return error
      await delay()
      const row = modifierGroups.find((g) => g.id === params.id)
      if (!row) return fail(404, "Not found.")
      const body = (await request.json()) as Partial<{
        name: string
        min_select: number
        max_select: number
        options: { id?: string; name: string; price_delta: number }[]
      }>
      const min = body.min_select ?? row.min_select
      const max = body.max_select ?? row.max_select
      if (min > max)
        return invalid({
          min_select: ["The minimum cannot be above the maximum."],
        })
      if (body.options && !body.options.length)
        return invalid({ options: ["Add at least one option."] })
      Object.assign(row, {
        name: body.name?.trim() ?? row.name,
        min_select: min,
        max_select: max,
      })
      if (body.options)
        row.options = body.options.map((option, index) => ({
          id: option.id ?? mockId(),
          name: option.name,
          price_delta: option.price_delta,
          sort_order: index,
        }))
      return ok(groupRow(row))
    }
  ),

  http.delete(
    apiPath("/catalog/modifier-groups/:id/"),
    async ({ request, params }) => {
      const error = guard(request, true)
      if (error) return error
      await delay()
      const index = modifierGroups.findIndex((g) => g.id === params.id)
      if (index < 0) return fail(404, "Not found.")
      modifierGroups.splice(index, 1)
      for (const product of products)
        product.modifier_groups = product.modifier_groups.filter(
          (id) => id !== params.id
        )
      return ok(undefined)
    }
  ),
]
