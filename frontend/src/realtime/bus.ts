export type Stream = "floor" | "orders" | "print"

export type RealtimeEvent = { type: string; [key: string]: unknown }

type Handler = (event: RealtimeEvent) => void

const handlers = new Map<Stream, Set<Handler>>()

/**
 * Events from the outlet, whichever way they arrive: the WebSocket in
 * production, or the mock API directly in mock mode. Screens listen here
 * and never know which.
 */
export const bus = {
  on(stream: Stream, handler: Handler) {
    const set = handlers.get(stream) ?? new Set<Handler>()
    set.add(handler)
    handlers.set(stream, set)
    return () => set.delete(handler)
  },
  emit(stream: Stream, event: RealtimeEvent) {
    for (const handler of handlers.get(stream) ?? []) handler(event)
  },
}
