import { create } from "zustand"

import type { Product } from "@/features/catalog/schemas/catalog.ts"
import { newId } from "@/lib/idempotency.ts"

export type CounterLine = {
  id: string
  product: string
  name: string
  image: string | null
  unit_price: number
  quantity: number
  tax_category: Product["tax_category"]
}

type CartState = {
  /** The id the sale will be sent with; kept across retries so a dropped request never sells twice. */
  saleId: string
  lines: CounterLine[]
  /** The line the last scan or tap touched, for the highlight flash. */
  touched: { id: string; at: number } | null
  add: (product: Product) => void
  setQuantity: (id: string, quantity: number) => void
  remove: (id: string) => void
  clear: () => void
}

/** The counter's open basket. Scanning the same item again adds to its quantity. */
export const useCounterCart = create<CartState>()((set) => ({
  saleId: newId(),
  lines: [],
  touched: null,
  add: (product) =>
    set((state) => {
      const match = state.lines.find((line) => line.product === product.id)
      if (match)
        return {
          lines: state.lines.map((line) =>
            line === match
              ? { ...line, quantity: Math.min(99, line.quantity + 1) }
              : line
          ),
          touched: { id: match.id, at: Date.now() },
        }
      const line: CounterLine = {
        id: newId(),
        product: product.id,
        name: product.name,
        image: product.image_url,
        unit_price: product.price,
        quantity: 1,
        tax_category: product.tax_category,
      }
      return {
        lines: [...state.lines, line],
        touched: { id: line.id, at: Date.now() },
      }
    }),
  setQuantity: (id, quantity) =>
    set((state) => ({
      lines: state.lines.map((line) =>
        line.id === id ? { ...line, quantity } : line
      ),
    })),
  remove: (id) =>
    set((state) => ({ lines: state.lines.filter((line) => line.id !== id) })),
  clear: () => set({ saleId: newId(), lines: [], touched: null }),
}))
