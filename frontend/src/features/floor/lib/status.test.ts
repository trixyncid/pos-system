import {
  minutesSince,
  stayTone,
  TYPICAL_STAY_MINUTES,
} from "@/features/floor/lib/status.ts"

describe("table timers", () => {
  const now = new Date("2026-10-30T19:00:00+07:00")

  it("counts whole minutes since guests sat down", () => {
    expect(minutesSince(null, now)).toBeNull()
    expect(minutesSince("2026-10-30T18:25:30+07:00", now)).toBe(34)
    // A clock slightly ahead on another tablet never shows negative time.
    expect(minutesSince("2026-10-30T19:01:00+07:00", now)).toBe(0)
  })

  it("warns as a stay runs long", () => {
    expect(stayTone(30)).toBe("currentColor")
    expect(stayTone(TYPICAL_STAY_MINUTES * 0.8)).toBe("var(--warning)")
    expect(stayTone(TYPICAL_STAY_MINUTES)).toBe("var(--danger)")
  })
})
