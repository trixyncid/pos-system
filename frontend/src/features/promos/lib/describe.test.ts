import {
  describeDays,
  describeHours,
  promoState,
} from "@/features/promos/lib/describe.ts"
import type { Promo } from "@/features/promos/schemas/promo.ts"

const promo = {
  is_active: true,
  starts_on: "2026-11-01",
  ends_on: "2026-11-30",
  starts_at: "14:00:00",
  ends_at: "17:00:00",
} as Promo

describe("promo descriptions", () => {
  it("collapses runs of days into ranges", () => {
    expect(describeDays([0, 1, 2, 3], "en")).toBe("Mon–Thu")
    expect(describeDays([5, 6], "en")).toBe("Sat, Sun")
    expect(describeDays([0, 2, 3, 4, 6], "en")).toBe("Mon, Wed–Fri, Sun")
    expect(describeDays([], "en")).toBeNull()
  })

  it("shows the hours the way receipts write times", () => {
    expect(describeHours(promo)).toBe("14.00–17.00")
  })

  it("knows when a promo has not started or has ended", () => {
    expect(promoState(promo, "2026-10-30")).toBe("later")
    expect(promoState(promo, "2026-11-15")).toBe("on")
    expect(promoState(promo, "2026-12-01")).toBe("ended")
    expect(promoState({ ...promo, is_active: false }, "2026-11-15")).toBe("off")
  })
})
