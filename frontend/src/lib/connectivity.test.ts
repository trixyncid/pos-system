import { isOfflineError } from "@/lib/connectivity.ts"

describe("isOfflineError", () => {
  it("means no connection, not a refusal", () => {
    expect(isOfflineError({ code: "ERR_NETWORK" })).toBe(true)
    expect(isOfflineError({ code: "ECONNABORTED" })).toBe(true)
    expect(isOfflineError({ response: { status: 502 } })).toBe(true)
    expect(isOfflineError({ response: { status: 400 } })).toBe(false)
    expect(isOfflineError({ response: { status: 500 } })).toBe(false)
    expect(isOfflineError({ code: "ERR_CANCELED" })).toBe(false)
    expect(isOfflineError(null)).toBe(false)
  })
})
