import { z } from "zod"

export const promoKindSchema = z.enum(["bill", "items", "bundle"])
export const benefitSchema = z.enum(["percent", "amount", "price"])
export const promoChannelSchema = z.enum(["all", "restaurant", "snackbar"])

/** backend promos.serializers.PromoSerializer */
export const promoSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  image_url: z.string().nullable(),
  kind: promoKindSchema,
  benefit: benefitSchema,
  value: z.number(),
  max_discount: z.number().nullable(),
  min_spend: z.number(),
  products: z.array(z.uuid()),
  categories: z.array(z.uuid()),
  buy_quantity: z.number().nullable(),
  get_quantity: z.number().nullable(),
  channel: promoChannelSchema,
  starts_on: z.string().nullable(),
  ends_on: z.string().nullable(),
  /** 0 = Monday … 6 = Sunday; empty means every day. */
  weekdays: z.array(z.number()),
  /** "14:00:00" */
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
})
export type Promo = z.infer<typeof promoSchema>

export const unavailableSchema = z.enum([
  "day",
  "time",
  "min_spend",
  "no_items",
])

/** A promo offered on one bill (GET /orders/{id}/promos/). */
export const offeredPromoSchema = promoSchema.extend({
  saving: z.number(),
  unavailable: unavailableSchema.nullable(),
  applied: z.boolean(),
})
export type OfferedPromo = z.infer<typeof offeredPromoSchema>

export type PromoForm = Omit<Promo, "id" | "image_url" | "created_at">
