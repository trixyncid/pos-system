import {
  costRatio,
  costTone,
  unitCost,
} from "@/features/catalog/lib/catalog.ts"

describe("catalog costs", () => {
  it("uses the recipe cost when there is one", () => {
    expect(unitCost({ recipe_cost: 6_145, cost: 9_000 })).toBe(6_145)
    expect(unitCost({ recipe_cost: null, cost: 9_000 })).toBe(9_000)
  })

  it("has no ratio without a price or a cost", () => {
    expect(costRatio(0, 5_000)).toBeNull()
    expect(costRatio(26_000, 0)).toBeNull()
    expect(costRatio(26_000, 6_500)).toBe(0.25)
  })

  it("judges food cost and retail cost on different bars", () => {
    expect(costTone(0.3, "menu")).toBe("success")
    expect(costTone(0.4, "menu")).toBe("warning")
    expect(costTone(0.51, "menu")).toBe("danger")
    expect(costTone(0.7, "retail")).toBe("success")
    expect(costTone(null, "retail")).toBe("neutral")
  })
})
