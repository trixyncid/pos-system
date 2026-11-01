import { create } from "zustand"

import { env } from "@/lib/env.ts"

export const STATIONS = ["kitchen", "bar", "cashier"] as const
export type Station = (typeof STATIONS)[number]

/** Where a station's tickets go: a LAN printer (raw port 9100) or a Windows shared USB printer. */
export type PrinterTarget =
  { type: "tcp"; host: string; port: number } | { type: "share"; name: string }

export type DevicePrinting = {
  /** This device prints the queue. Only the cashier PC (or one print station) should. */
  enabled: boolean
  /** "agent": real printers through the print agent; "preview": tickets on screen only. */
  mode: "agent" | "preview"
  agentUrl: string
  stations: Station[]
  printers: Partial<Record<Station, PrinterTarget>>
  /** Open the cash drawer (wired to the cashier printer) on cash receipts. */
  drawer: boolean
}

const storageKey = "pos.printing"

// Demo mode prints on screen straight away; a real device opts in on the Print station page,
// so a phone or a second tablet never marks tickets printed that no printer printed.
const defaults: DevicePrinting = {
  enabled: env.useMocks,
  mode: env.useMocks ? "preview" : "agent",
  agentUrl: "http://127.0.0.1:9123",
  stations: [...STATIONS],
  printers: {},
  drawer: true,
}

function load(): DevicePrinting {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw)
      return { ...defaults, ...(JSON.parse(raw) as Partial<DevicePrinting>) }
    // The station list chosen before this setting existed.
    const old = window.localStorage.getItem("pos.station.stations")
    if (old) return { ...defaults, stations: JSON.parse(old) as Station[] }
  } catch {
    // Fall through to the defaults.
  }
  return defaults
}

/** This device's printing setup. It belongs to the device, so it lives in this browser. */
export const useDevicePrinting = create<
  DevicePrinting & { update: (change: Partial<DevicePrinting>) => void }
>()((set, get) => ({
  ...load(),
  update: (change) => {
    set(change)
    const { enabled, mode, agentUrl, stations, printers, drawer } = get()
    const saved: DevicePrinting = {
      enabled,
      mode,
      agentUrl,
      stations,
      printers,
      drawer,
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(saved))
    } catch {
      // Private mode: kept until this page reloads.
    }
  },
}))

/** "192.168.1.50", "192.168.1.50:9100" or "share:XS80" (a Windows shared printer) to a target. */
export function parsePrinter(text: string): PrinterTarget | null {
  const value = text.trim()
  if (!value) return null
  if (value.toLowerCase().startsWith("share:")) {
    const name = value.slice(6).trim()
    return /^[\w .-]{1,80}$/.test(name) ? { type: "share", name } : null
  }
  const match = /^([\w.-]+)(?::(\d{1,5}))?$/.exec(value)
  if (!match) return null
  const port = match[2] ? Number(match[2]) : 9100
  return port >= 1 && port <= 65_535
    ? { type: "tcp", host: match[1]!, port }
    : null
}

export function formatPrinter(target: PrinterTarget | undefined) {
  if (!target) return ""
  if (target.type === "share") return `share:${target.name}`
  return target.port === 9100 ? target.host : `${target.host}:${target.port}`
}
