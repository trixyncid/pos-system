import {
  pendingSales,
  useOutbox,
  type QueuedSale,
} from "@/features/snackbar/store/outbox.ts"

const sale = (id: string): QueuedSale => ({
  body: {
    id,
    method: "cash",
    tendered: 50_000,
    lines: [{ id: `${id}-line`, product: "chips", quantity: 1 }],
    sold_at: "2026-11-07T02:00:00Z",
    cashier: 2,
    printed: true,
  },
  total: 12_000,
  cashierName: "Budi",
  lines: [{ name: "Keripik", quantity: 1 }],
  error: null,
})

describe("offline sales queue", () => {
  beforeEach(() => useOutbox.setState({ sales: [] }))

  it("keeps each sale once, in order, and survives a reload", () => {
    const { add } = useOutbox.getState()
    add(sale("a"))
    add(sale("b"))
    add(sale("a"))
    expect(useOutbox.getState().sales.map((s) => s.body.id)).toEqual(["a", "b"])
    const saved = JSON.parse(window.localStorage.getItem("pos.outbox") ?? "{}")
    expect(saved.state.sales).toHaveLength(2)
  })

  it("holds a refused sale back until someone retries", () => {
    const { add, fail, retry, remove } = useOutbox.getState()
    add(sale("a"))
    add(sale("b"))
    fail("a", "No open shift.")
    expect(
      pendingSales(useOutbox.getState().sales).map((s) => s.body.id)
    ).toEqual(["b"])
    retry()
    expect(pendingSales(useOutbox.getState().sales)).toHaveLength(2)
    remove("a")
    expect(useOutbox.getState().sales.map((s) => s.body.id)).toEqual(["b"])
  })
})
