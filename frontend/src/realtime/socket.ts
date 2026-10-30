import { refreshSession } from "@/lib/api.ts"
import { env } from "@/lib/env.ts"
import { getAccessToken } from "@/lib/session.ts"
import { bus, type Stream } from "@/realtime/bus.ts"

const SUBPROTOCOL = "pos-auth"
const MAX_BACKOFF_MS = 30_000

/** wss://api.example.com/ws/outlet/ from VITE_API_URL, or the dev server's /ws proxy. */
function socketUrl() {
  const base = env.apiUrl.startsWith("http")
    ? new URL(env.apiUrl)
    : new URL(env.apiUrl, window.location.origin)
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:"
  base.pathname = "/ws/outlet/"
  base.search = ""
  return base.toString()
}

export type ConnectionState = "connecting" | "open" | "closed"

/**
 * One socket per tablet, subscribed to the streams this user may see. It
 * reconnects with backoff, and refreshes the access token when the server
 * closes with 4401 (expired). Events go to the shared bus.
 */
export function connect(
  streams: Stream[],
  onState: (state: ConnectionState) => void
) {
  let socket: WebSocket | null = null
  let attempt = 0
  let stopped = false
  let timer: number | undefined

  const open = async () => {
    if (stopped) return
    onState("connecting")
    let token = getAccessToken()
    if (!token) {
      try {
        token = await refreshSession()
      } catch {
        schedule()
        return
      }
    }
    socket = new WebSocket(socketUrl(), [SUBPROTOCOL, token])
    socket.onopen = () => {
      attempt = 0
      onState("open")
      for (const stream of streams)
        socket?.send(JSON.stringify({ type: "subscribe", stream }))
    }
    socket.onmessage = (message) => {
      try {
        const data = JSON.parse(String(message.data)) as {
          type: string
          stream?: Stream
          event?: { type: string }
        }
        if (data.type === "event" && data.stream && data.event)
          bus.emit(data.stream, data.event)
      } catch {
        // A malformed frame is ignored; the next refetch corrects anything missed.
      }
    }
    socket.onclose = (event) => {
      onState("closed")
      if (stopped) return
      if (event.code === 4401)
        void refreshSession()
          .catch(() => undefined)
          .finally(schedule)
      else schedule()
    }
  }

  const schedule = () => {
    if (stopped) return
    attempt += 1
    const delay =
      Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.min(attempt, 5)) *
      (0.75 + Math.random() / 2)
    timer = window.setTimeout(() => void open(), delay)
  }

  void open()
  return () => {
    stopped = true
    window.clearTimeout(timer)
    socket?.close()
  }
}
