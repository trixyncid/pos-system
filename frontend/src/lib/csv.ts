/**
 * A CSV that Excel and Google Sheets open cleanly: a byte-order mark so
 * "Rp" and accented names survive, quoted fields where needed, and
 * formula-looking text defused so a cell can never run as a formula.
 */
export function toCsv(rows: (string | number | null)[][]) {
  const cell = (value: string | number | null) => {
    if (value === null) return ""
    if (typeof value === "number") return String(value)
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
    return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  return "﻿" + rows.map((row) => row.map(cell).join(",")).join("\r\n")
}

export function downloadCsv(
  filename: string,
  rows: (string | number | null)[][]
) {
  const url = URL.createObjectURL(
    new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" })
  )
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
