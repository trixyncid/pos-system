import { change } from "@/features/reports/lib/format.ts"

describe("change", () => {
  it("is a rounded percentage, or null with nothing to compare", () => {
    expect(change(120, 100)).toBe(20)
    expect(change(90, 120)).toBe(-25)
    expect(change(5, 0)).toBeNull()
  })
})
