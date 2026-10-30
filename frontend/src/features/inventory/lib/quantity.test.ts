import {
  formatChange,
  formatQuantity,
  parseQuantity,
} from "@/features/inventory/lib/quantity.ts"

describe("stock quantities", () => {
  it("shows kilos and litres once they read better", () => {
    expect(formatQuantity(12_500, "g")).toBe("12,5 kg")
    expect(formatQuantity(750, "ml")).toBe("750 ml")
    expect(formatQuantity(1_500, "ml")).toBe("1,5 L")
    expect(formatQuantity(1_500, "pcs")).toBe("1.500 pcs")
  })

  it("signs ledger changes", () => {
    expect(formatChange(-300, "g")).toBe("−300 g")
    expect(formatChange(2, "pcs")).toBe("+2 pcs")
  })
})

describe("typed quantities", () => {
  it("accepts a comma or a dot for decimals", () => {
    expect(parseQuantity("1,5")).toBe(1.5)
    expect(parseQuantity("12")).toBe(12)
    expect(parseQuantity("0.25")).toBe(0.25)
    expect(parseQuantity("1,2345")).toBeNaN()
    expect(parseQuantity("")).toBeNaN()
  })
})
