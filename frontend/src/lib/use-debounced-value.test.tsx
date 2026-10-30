import { act, renderHook } from "@testing-library/react"

import { useDebouncedValue } from "@/lib/use-debounced-value.ts"

describe("useDebouncedValue", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("settles only after the value stops changing", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: "" } }
    )
    rerender({ value: "n" })
    act(() => vi.advanceTimersByTime(200))
    rerender({ value: "na" })
    act(() => vi.advanceTimersByTime(200))
    expect(result.current).toBe("")
    act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe("na")
  })
})
