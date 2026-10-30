import { useOrderMutation } from "@/features/ordering/api/orders.ts"
import { orderSchema } from "@/features/ordering/schemas/order.ts"
import { shiftKeys } from "@/features/shifts/api/shifts.ts"
import { api } from "@/lib/api.ts"
import { idempotencyHeaders } from "@/lib/idempotency.ts"

const parse = (data: { data: unknown }) => orderSchema.parse(data.data)

export type DiscountBody = {
  kind: "none" | "percent" | "amount"
  value: number
  reason: string
  approver?: number
  approver_pin?: string
}

export function useSetDiscount() {
  return useOrderMutation(
    async ({ orderId, ...body }: DiscountBody & { orderId: string }) =>
      parse((await api.post(`/orders/${orderId}/discount/`, body)).data)
  )
}

/** Prints the bill at the cashier printer and marks the table "bill asked". */
export function usePrintBill() {
  return useOrderMutation(
    async (orderId: string) =>
      parse((await api.post(`/orders/${orderId}/bill/`)).data),
    false
  )
}

export type PayMethod = "cash" | "qris"

export type PayBody = {
  id: string
  method: PayMethod
  tendered: number
  /** An even split: this part of what is left. */
  amount?: number
  /** Pay by item: these lines and their share of discount, service and tax. */
  line_ids?: string[]
}

export function usePay() {
  return useOrderMutation(
    async ({ orderId, ...body }: PayBody & { orderId: string }) =>
      parse(
        (
          await api.post(`/orders/${orderId}/payments/`, body, {
            headers: idempotencyHeaders(body.id),
          })
        ).data
      ),
    true,
    [shiftKeys.all]
  )
}
