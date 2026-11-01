/**
 * What the customer display shows, sent by the cashier's screen. It is a
 * snapshot, not a diff: every message carries the whole view, so a display
 * that reconnects is right again straight away.
 */
export type DisplayLine = {
  id: string
  name: string
  quantity: number
  total: number
  /** Chosen options, e.g. "Pedas, Telur ceplok". */
  detail?: string
}

export type DisplayBill = {
  subtotal: number
  discount: number
  service: number
  tax: number
  rounding: number
  total: number
}

export type DisplayState =
  | { view: "idle" }
  | {
      view: "cart"
      channel: "restaurant" | "snackbar"
      /** "Meja 5" or "Snack bar". */
      label: string
      lines: DisplayLine[]
      bill: DisplayBill
      discountLabel?: string
      /** What this guest pays now, when it differs from the bill (paid in part, split). */
      due?: number
      /** The line a scan or tap just touched, highlighted on the display. */
      touched?: string
    }
  | { view: "paid"; total: number; change: number }

export const IDLE: DisplayState = { view: "idle" }

/** The channel the cashier's tab and the display tab share in mock mode (no server to relay). */
export const MOCK_CHANNEL = "pos.display"
export type MockMessage =
  | { type: "paired"; code: string }
  | { type: "state"; state: DisplayState }
  | { type: "revoked" }
