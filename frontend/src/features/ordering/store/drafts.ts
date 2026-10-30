import { create } from "zustand"

import type { DraftLine } from "@/features/ordering/schemas/order.ts"

/** Same item, same choices, same note and seat: a second tap adds to the quantity instead of a new line. */
export function sameLine(
  a: DraftLine,
  b: Omit<DraftLine, "id" | "quantity" | "hold">
) {
  return (
    a.product === b.product &&
    a.note === b.note &&
    a.seat === b.seat &&
    a.modifiers
      .map((m) => m.id)
      .sort()
      .join() ===
      b.modifiers
        .map((m) => m.id)
        .sort()
        .join()
  )
}

type DraftState = {
  /** New lines per order, on this tablet only until they are sent or saved. */
  byOrder: Record<string, DraftLine[]>
  add: (orderId: string, line: DraftLine) => void
  update: (orderId: string, id: string, patch: Partial<DraftLine>) => void
  remove: (orderId: string, id: string) => void
  clear: (orderId: string, ids?: string[]) => void
}

export const useDrafts = create<DraftState>()((set) => ({
  byOrder: {},
  add: (orderId, line) =>
    set((state) => {
      const lines = state.byOrder[orderId] ?? []
      const match = lines.find(
        (existing) => !existing.hold && sameLine(existing, line)
      )
      const next = match
        ? lines.map((existing) =>
            existing === match
              ? { ...existing, quantity: existing.quantity + line.quantity }
              : existing
          )
        : [...lines, line]
      return { byOrder: { ...state.byOrder, [orderId]: next } }
    }),
  update: (orderId, id, patch) =>
    set((state) => ({
      byOrder: {
        ...state.byOrder,
        [orderId]: (state.byOrder[orderId] ?? []).map((line) =>
          line.id === id ? { ...line, ...patch } : line
        ),
      },
    })),
  remove: (orderId, id) =>
    set((state) => ({
      byOrder: {
        ...state.byOrder,
        [orderId]: (state.byOrder[orderId] ?? []).filter(
          (line) => line.id !== id
        ),
      },
    })),
  clear: (orderId, ids) =>
    set((state) => ({
      byOrder: {
        ...state.byOrder,
        [orderId]: ids
          ? (state.byOrder[orderId] ?? []).filter(
              (line) => !ids.includes(line.id)
            )
          : [],
      },
    })),
}))

const EMPTY: DraftLine[] = []

export function useOrderDrafts(orderId: string) {
  return useDrafts((state) => state.byOrder[orderId] ?? EMPTY)
}
