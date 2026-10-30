import { billTotals, formatIDR, percentOf, roundCash } from "@/lib/money.ts"

describe("money", () => {
  it("formats rupiah without decimals", () => {
    expect(formatIDR(25000)).toBe("Rp 25.000")
    expect(formatIDR(0)).toBe("Rp 0")
  })

  it("applies a percentage rounded half-up", () => {
    expect(percentOf(18_500, 10)).toBe(1850)
    expect(percentOf(18_505, 10)).toBe(1851)
  })

  it("rounds cash to the configured unit", () => {
    expect(roundCash(20_350, 100)).toBe(20_400)
    expect(roundCash(20_349, 100)).toBe(20_300)
    expect(roundCash(20_250, 500)).toBe(20_500)
    expect(roundCash(20_249, 1)).toBe(20_249)
  })
})

describe("billTotals", () => {
  const rules = {
    servicePercent: 5,
    pbjtPercent: 10,
    taxBase: "subtotal_with_service" as const,
    rounding: 100,
  }

  it("charges service, then PBJT on subtotal plus service, then rounds", () => {
    expect(billTotals(72_000, 0, rules)).toEqual({
      subtotal: 72_000,
      discount: 0,
      service: 3_600,
      tax: 7_560,
      rounding: 40,
      total: 83_200,
    })
  })

  it("can charge PBJT on the subtotal only", () => {
    const bill = billTotals(72_000, 0, { ...rules, taxBase: "subtotal" })
    expect(bill.tax).toBe(7_200)
    expect(bill.total).toBe(82_800)
  })

  it("applies the discount first and never goes below zero", () => {
    expect(billTotals(50_000, 10_000, rules).service).toBe(2_000)
    expect(billTotals(5_000, 9_000, rules)).toMatchObject({
      discount: 5_000,
      total: 0,
    })
  })
})
