import { toCsv } from "@/lib/csv.ts"

describe("csv", () => {
  it("quotes what needs quoting and defuses formulas", () => {
    const csv = toCsv([
      ["Nama", "Jumlah"],
      ['Es teh "manis", dingin', 3],
      ["=SUM(A1)", null],
    ])
    expect(csv.startsWith("﻿")).toBe(true)
    expect(csv.slice(1).split("\r\n")).toEqual([
      "Nama,Jumlah",
      '"Es teh ""manis"", dingin",3',
      "'=SUM(A1),",
    ])
  })
})
