import { createScanBuffer } from "@/lib/scanner.ts"

function type(text: string, gap: number, start = 1_000) {
  const scans: string[] = []
  const buffer = createScanBuffer((code) => scans.push(code))
  let at = start
  for (const key of [...text, "Enter"]) {
    buffer.push(key, at)
    at += gap
  }
  return scans
}

describe("scan buffer", () => {
  it("reads a fast run ending in Enter as a scan", () => {
    expect(type("8991000007919", 8)).toEqual(["8991000007919"])
  })

  it("ignores a person typing", () => {
    expect(type("8991000007919", 120)).toEqual([])
  })

  it("ignores short bursts", () => {
    expect(type("123", 5)).toEqual([])
  })

  it("starts over after a pause", () => {
    const scans: string[] = []
    const buffer = createScanBuffer((code) => scans.push(code))
    buffer.push("9", 0)
    let at = 500
    for (const key of [..."8991000007919", "Enter"]) buffer.push(key, (at += 5))
    expect(scans).toEqual(["8991000007919"])
  })
})
