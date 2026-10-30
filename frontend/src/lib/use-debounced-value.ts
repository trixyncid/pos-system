import { useEffect, useState } from "react"

/**
 * `value`, but only once it has stopped changing for `delay` ms. Typing in a
 * search box filters once at the end instead of on every key, which keeps
 * slower tablets smooth.
 */
export function useDebouncedValue<T>(value: T, delay = 300) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return settled
}
