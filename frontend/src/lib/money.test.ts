import {
  billTotals,
  discountAmount,
  evenPart,
  formatIDR,
  percentOf,
  quickCash,
  roundCash,
  shareTotals,
} from "@/lib/money.ts"

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

describe("checkout helpers", () => {
  const rules = {
    servicePercent: 5,
    pbjtPercent: 10,
    taxBase: "subtotal_with_service" as const,
    rounding: 100,
  }

  it("matches the backend for a percent discount", () => {
    // backend payments/test_payments: 44.000 − 10% → 45.700
    const discount = discountAmount("percent", 10, 44_000)
    expect(billTotals(44_000, discount, rules).total).toBe(45_700)
  })

  it("prices one item's share like the backend", () => {
    expect(shareTotals(28_000, 44_000, 0, rules).total).toBe(32_300)
  })

  it("splits evenly, rounding parts up to the cash unit", () => {
    expect(evenPart(50_800, 3, 100)).toBe(17_000)
    expect(evenPart(16_800, 1, 100)).toBe(16_800)
  })

  it("offers the exact amount and the notes guests hand over", () => {
    expect(quickCash(50_800)).toEqual([50_800, 60_000, 100_000, 200_000])
    expect(quickCash(100_000)).toEqual([100_000, 200_000])
  })
})

describe("counter sales and retail lines", () => {
  const rules = {
    servicePercent: 5,
    pbjtPercent: 10,
    taxBase: "subtotal_with_service" as const,
    rounding: 100,
  }

  it("charges no service and PBJT only on restaurant items (backend test_sales)", () => {
    expect(
      billTotals(46_000, 0, rules, { service: false, taxable: 22_000 }).total
    ).toBe(48_200)
  })

  it("charges retail items at a table service but not PBJT", () => {
    const bill = billTotals(40_000, 0, rules, { taxable: 28_000 })
    expect([bill.service, bill.tax, bill.total]).toEqual([2_000, 2_940, 44_900])
  })
})
