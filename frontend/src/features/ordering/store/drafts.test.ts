import type { DraftLine } from "@/features/ordering/schemas/order.ts"
import { useDrafts } from "@/features/ordering/store/drafts.ts"

function draft(overrides: Partial<DraftLine> = {}): DraftLine {
  return {
    id: crypto.randomUUID(),
    product: "p1",
    name: "Es Teh",
    image: null,
    unit_price: 8_000,
    quantity: 1,
    modifiers: [],
    note: "",
    seat: null,
    hold: false,
    ...overrides,
  }
}

describe("draft lines", () => {
  beforeEach(() => useDrafts.setState({ byOrder: {} }))

  it("adds to the quantity when the same item is tapped again", () => {
    const { add } = useDrafts.getState()
    add("o1", draft())
    add("o1", draft({ quantity: 2 }))
    expect(useDrafts.getState().byOrder.o1).toHaveLength(1)
    expect(useDrafts.getState().byOrder.o1?.[0]?.quantity).toBe(3)
  })

  it("keeps different choices, notes and seats apart", () => {
    const { add } = useDrafts.getState()
    add("o1", draft())
    add("o1", draft({ note: "tanpa es" }))
    add("o1", draft({ seat: 2 }))
    add(
      "o1",
      draft({
        modifiers: [
          { id: "m1", group: "Gula", name: "Tanpa gula", price_delta: 0 },
        ],
      })
    )
    expect(useDrafts.getState().byOrder.o1).toHaveLength(4)
  })

  it("clears only the lines that were sent", () => {
    const { add, clear } = useDrafts.getState()
    const a = draft()
    const b = draft({ product: "p2" })
    add("o1", a)
    add("o1", b)
    clear("o1", [a.id])
    expect(useDrafts.getState().byOrder.o1?.map((line) => line.id)).toEqual([
      b.id,
    ])
  })
})
