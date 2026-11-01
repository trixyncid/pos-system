import { env } from "@/lib/env.ts"
import {
  IDLE,
  MOCK_CHANNEL,
  type DisplayState,
  type MockMessage,
} from "@/features/display/lib/state.ts"

/**
 * The display's side of the link. It has no staff login: it registers once,
 * keeps its token in this browser, shows a pairing code until a cashier
 * enters it, then follows whatever that cashier sends over its own socket.
 * In mock mode the cashier's tab talks to it over a BroadcastChannel.
 */
const storageKey = "pos.display.self"
const SUBPROTOCOL = "pos-display"
const MAX_BACKOFF_MS = 30_000

type Stored = { id: string; token: string; code: string | null }

export type LinkStatus =
  | { kind: "starting" }
  | { kind: "pairing"; code: string }
  | { kind: "live"; state: DisplayState }
  | { kind: "offline"; state: DisplayState }

export type Outlet = { name: string; address: string }

function load(): Stored | null {
  try {
    const raw = window.localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw) as Stored) : null
  } catch {
    return null
  }
}

function save(value: Stored | null) {
  try {
    if (value) window.localStorage.setItem(storageKey, JSON.stringify(value))
    else window.localStorage.removeItem(storageKey)
  } catch {
    // Private mode: the display pairs again after a reload.
  }
}

type SelfView = {
  id: string
  paired: boolean
  code: string | null
  outlet: Outlet
  token?: string
}

async function call(path: string, init?: RequestInit): Promise<SelfView> {
  const response = await fetch(`${env.apiUrl}${path}`, init)
  if (!response.ok)
    throw Object.assign(new Error(path), { status: response.status })
  const body = (await response.json()) as { data: SelfView }
  return body.data
}

function socketUrl() {
  const base = env.apiUrl.startsWith("http")
    ? new URL(env.apiUrl)
    : new URL(env.apiUrl, window.location.origin)
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:"
  base.pathname = "/ws/display/"
  base.search = ""
  return base.toString()
}

export function connectDisplay(
  onStatus: (status: LinkStatus) => void,
  onOutlet: (outlet: Outlet) => void
) {
  if (env.useMocks) return connectMock(onStatus, onOutlet)

  let stopped = false
  let socket: WebSocket | null = null
  let timer: number | undefined
  let attempt = 0
  let last: DisplayState = IDLE

  const retry = () => {
    if (stopped) return
    const delay = Math.min(1_000 * 2 ** attempt, MAX_BACKOFF_MS)
    attempt += 1
    timer = window.setTimeout(() => void start(), delay)
  }

  const start = async () => {
    if (stopped) return
    let stored = load()
    let view: SelfView
    try {
      if (stored) {
        view = await call("/displays/self/", {
          headers: { "X-Display-Token": stored.token },
        })
      } else {
        view = await call("/displays/register/", { method: "POST" })
        stored = { id: view.id, token: view.token!, code: view.code }
        save(stored)
      }
    } catch (error) {
      // Removed in Settings, or the server forgot it: start over with a new code.
      if ((error as { status?: number }).status === 401) save(null)
      onStatus({ kind: "offline", state: last })
      retry()
      return
    }
    onOutlet(view.outlet)
    if (!view.paired && view.code)
      onStatus({ kind: "pairing", code: view.code })

    socket = new WebSocket(socketUrl(), [SUBPROTOCOL, stored.token])
    socket.onopen = () => {
      attempt = 0
      if (view.paired) onStatus({ kind: "live", state: last })
    }
    socket.onmessage = (frame) => {
      try {
        const message = JSON.parse(String(frame.data)) as
          | { type: "state"; state: DisplayState }
          | { type: "paired" }
          | { type: "revoked" }
        if (message.type === "state") {
          last = message.state
          onStatus({ kind: "live", state: last })
        } else if (message.type === "paired") {
          view = { ...view, paired: true }
          onStatus({ kind: "live", state: IDLE })
        } else if (message.type === "revoked") {
          save(null)
          socket?.close()
        }
      } catch {
        // A malformed frame is ignored; the next state replaces it.
      }
    }
    socket.onclose = () => {
      if (stopped) return
      if (load()) onStatus({ kind: "offline", state: last })
      retry()
    }
  }

  void start()
  return () => {
    stopped = true
    window.clearTimeout(timer)
    socket?.close()
  }
}

function connectMock(
  onStatus: (status: LinkStatus) => void,
  onOutlet: (outlet: Outlet) => void
) {
  onOutlet({
    name: "Yi Ci Pang",
    address: "Jl. Ade Irma Suryani No. 68, Samarinda",
  })
  let stored = load()
  if (!stored) {
    stored = {
      id: "mock-display",
      token: "mock",
      code: String(Math.floor(100_000 + Math.random() * 900_000)),
    }
    save(stored)
  }
  const code = stored.code
  if (code) onStatus({ kind: "pairing", code })
  else onStatus({ kind: "live", state: IDLE })

  const channel = new BroadcastChannel(MOCK_CHANNEL)
  channel.onmessage = (event: MessageEvent<MockMessage>) => {
    const message = event.data
    if (message.type === "paired" && message.code === load()?.code) {
      save({ ...stored, code: null })
      onStatus({ kind: "live", state: IDLE })
    } else if (message.type === "state" && !load()?.code) {
      onStatus({ kind: "live", state: message.state })
    } else if (message.type === "revoked") {
      save(null)
      window.location.reload()
    }
  }
  return () => channel.close()
}
