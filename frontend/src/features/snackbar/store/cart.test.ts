import type { Product } from "@/features/catalog/schemas/catalog.ts"
import { useCounterCart } from "@/features/snackbar/store/cart.ts"

const chips = {
  id: "0192f3a0-0000-7000-8000-0000000000aa",
  name: "Keripik",
  price: 12_000,
  image_url: null,
  tax_category: "ppn",
} as Product

describe("counter cart", () => {
  beforeEach(() => useCounterCart.getState().clear())

  it("scanning the same item again adds to its quantity", () => {
    const { add } = useCounterCart.getState()
    add(chips)
    add(chips)
    const { lines, touched } = useCounterCart.getState()
    expect(lines).toHaveLength(1)
    expect(lines[0]?.quantity).toBe(2)
    expect(touched?.id).toBe(lines[0]?.id)
  })

  it("starts a new sale id once cleared", () => {
    const before = useCounterCart.getState().saleId
    useCounterCart.getState().clear()
    expect(useCounterCart.getState().saleId).not.toBe(before)
  })
})
