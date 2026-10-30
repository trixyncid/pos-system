import { formatIDR, percentOf, roundCash } from "@/lib/money.ts"

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
