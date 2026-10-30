/** Calendar dates as the API takes them ("2026-10-30"), in the tablet's own time zone. */
export function isoDate(day: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}

export function parseIsoDate(text: string) {
  const [year, month, day] = text.split("-").map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1)
}

export function addDays(text: string, days: number) {
  const day = parseIsoDate(text)
  day.setDate(day.getDate() + days)
  return isoDate(day)
}

export const today = () => isoDate(new Date())
