import { formatIDR } from "@/lib/money.ts"

/** Balanced is good; over is odd (change not given?); short is the one to chase. */
export function varianceTone(variance: number) {
  return variance === 0 ? "success" : variance > 0 ? "warning" : "danger"
}

export function signedIDR(amount: number) {
  const rounded = Math.round(amount)
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : ""
  return `${sign}${formatIDR(Math.abs(rounded))}`
}
