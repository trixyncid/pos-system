import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { SaleBody } from "@/features/snackbar/api/sales.ts"

/** What the server needs to record a sale made while it couldn't be reached. */
export type OfflineSaleBody = SaleBody & {
  /** When it happened (ISO); reports file it then, not when it synced. */
  sold_at: string
  /** Who sold it, whoever is signed in when it syncs. */
  cashier: number
  /** The PC printed the receipt and tickets already, so the server queues none. */
  printed: boolean
}

export type QueuedSale = {
  body: OfflineSaleBody
  /** For the list on screen until it syncs. */
  total: number
  cashierName: string
  lines: { name: string; quantity: number }[]
  /** Set when the server refused it; it then waits for someone to retry or remove it. */
  error: string | null
}

type OutboxState = {
  sales: QueuedSale[]
  add: (sale: QueuedSale) => void
  remove: (id: string) => void
  fail: (id: string, error: string) => void
  /** Clears every error, so the refused sales are sent again. */
  retry: () => void
}

/**
 * Counter sales made with no internet, oldest first, kept in this browser
 * until the server has them. Each one keeps the id it was made with, so
 * sending it twice (a dropped answer, two tabs) still records one sale.
 */
export const useOutbox = create<OutboxState>()(
  persist(
    (set) => ({
      sales: [],
      add: (sale) =>
        set((state) =>
          state.sales.some((queued) => queued.body.id === sale.body.id)
            ? state
            : { sales: [...state.sales, sale] }
        ),
      remove: (id) =>
        set((state) => ({
          sales: state.sales.filter((sale) => sale.body.id !== id),
        })),
      fail: (id, error) =>
        set((state) => ({
          sales: state.sales.map((sale) =>
            sale.body.id === id ? { ...sale, error } : sale
          ),
        })),
      retry: () =>
        set((state) => ({
          sales: state.sales.map((sale) => ({ ...sale, error: null })),
        })),
    }),
    {
      name: "pos.outbox",
      version: 1,
      storage: createJSONStorage(() => window.localStorage),
    }
  )
)

/** Sales still to send (not counting ones the server refused). */
export function pendingSales(sales: QueuedSale[]) {
  return sales.filter((sale) => sale.error === null)
}
