import { useEffect, useRef } from "react"

/**
 * A USB or Bluetooth barcode scanner is a keyboard that types very fast:
 * the digits arrive a few milliseconds apart and end with Enter. A person
 * typing never gets under ~50 ms between keys, so a fast run ending in Enter
 * is a scan and anything slower is someone typing.
 */
export const SCAN_GAP_MS = 50
export const MIN_SCAN_LENGTH = 6

export function createScanBuffer(onScan: (code: string) => void) {
  let buffer = ""
  let last = 0
  return {
    /** Feed one key with its timestamp; returns true when it was part of a scan. */
    push(key: string, at: number) {
      const fast = at - last <= SCAN_GAP_MS
      last = at
      if (key === "Enter") {
        const code = buffer
        buffer = ""
        if (code.length >= MIN_SCAN_LENGTH && fast) {
          onScan(code)
          return true
        }
        return false
      }
      if (key.length !== 1) return false
      buffer = fast ? buffer + key : key
      return buffer.length > 1
    },
  }
}

const editable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))

/**
 * Listens for scans anywhere on the page while `enabled`. Keys typed into a
 * text field are left alone (the field handles its own Enter), so the
 * search box keeps working and a scan into it is caught by the page there.
 */
export function useScanner(onScan: (code: string) => void, enabled = true) {
  const handler = useRef(onScan)
  useEffect(() => {
    handler.current = onScan
  })
  useEffect(() => {
    if (!enabled) return
    const buffer = createScanBuffer((code) => handler.current(code))
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (editable(event.target)) return
      if (buffer.push(event.key, event.timeStamp) && event.key === "Enter")
        event.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [enabled])
}
