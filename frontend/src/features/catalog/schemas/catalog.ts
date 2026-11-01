import { z } from "zod"

export const stationSchema = z.enum(["kitchen", "bar", "none"])
export type Station = z.infer<typeof stationSchema>

export const kindSchema = z.enum(["menu", "retail", "ingredient"])
export type ProductKind = z.infer<typeof kindSchema>

export const unitSchema = z.enum(["portion", "pcs", "g", "ml"])
export type Unit = z.infer<typeof unitSchema>

export const taxCategorySchema = z.enum(["pbjt", "ppn", "none"])

export const categorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  station: stationSchema,
  sort_order: z.number(),
  is_active: z.boolean(),
  product_count: z.number(),
})
export type Category = z.infer<typeof categorySchema>

export const modifierSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  price_delta: z.number(),
  sort_order: z.number(),
})

export const modifierGroupSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  min_select: z.number(),
  max_select: z.number(),
  sort_order: z.number(),
  options: z.array(modifierSchema),
  product_count: z.number(),
})
export type ModifierGroup = z.infer<typeof modifierGroupSchema>

export const recipeLineSchema = z.object({
  ingredient: z.uuid(),
  ingredient_name: z.string(),
  unit: unitSchema,
  quantity: z.number(),
  cost: z.number(),
})
export type RecipeLine = z.infer<typeof recipeLineSchema>

export const productSchema = z.object({
  id: z.uuid(),
  kind: kindSchema,
  name: z.string(),
  description: z.string(),
  category: z.uuid().nullable(),
  category_name: z.string().nullable(),
  price: z.number(),
  cost: z.number(),
  unit: unitSchema,
  barcode: z.string().nullable(),
  sku: z.string(),
  tax_category: taxCategorySchema,
  track_stock: z.boolean(),
  low_stock_threshold: z.number().nullable(),
  image_url: z.string().nullable(),
  is_available: z.boolean(),
  is_favorite: z.boolean(),
  is_active: z.boolean(),
  sort_order: z.number(),
  modifier_groups: z.array(z.uuid()),
  recipe: z.array(recipeLineSchema),
  recipe_cost: z.number().nullable(),
})
export type Product = z.infer<typeof productSchema>

const money = z
  .number({ message: "validation.number" })
  .int("validation.wholeRupiah")
  .min(0, "validation.notNegative")

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, "validation.categoryName"),
  station: stationSchema,
  is_active: z.boolean(),
})
export type CategoryForm = z.infer<typeof categoryFormSchema>

export const productFormSchema = z
  .object({
    kind: kindSchema,
    name: z.string().trim().min(1, "validation.name"),
    description: z.string().max(300),
    category: z.string().nullable(),
    price: money,
    cost: money,
    unit: unitSchema,
    barcode: z.string().trim().max(32),
    sku: z.string().trim().max(40),
    tax_category: taxCategorySchema,
    track_stock: z.boolean(),
    is_available: z.boolean(),
    is_favorite: z.boolean(),
    modifier_groups: z.array(z.string()),
    recipe: z.array(
      z.object({
        ingredient: z.string(),
        quantity: z.number().positive("validation.moreThanZero"),
      })
    ),
  })
  .refine((value) => value.kind === "ingredient" || value.category, {
    path: ["category"],
    message: "validation.pickCategory",
  })
export type ProductForm = z.infer<typeof productFormSchema>

export const modifierGroupFormSchema = z
  .object({
    name: z.string().trim().min(1, "validation.name"),
    min_select: z.number().int().min(0),
    max_select: z.number().int().min(1),
    options: z
      .array(
        z.object({
          id: z.string().optional(),
          name: z.string().trim().min(1, "validation.optionName"),
          price_delta: z.number().int(),
        })
      )
      .min(1, "validation.oneOption"),
  })
  .refine((value) => value.min_select <= value.max_select, {
    path: ["min_select"],
    message: "validation.minOverMax",
  })
export type ModifierGroupForm = z.infer<typeof modifierGroupFormSchema>
