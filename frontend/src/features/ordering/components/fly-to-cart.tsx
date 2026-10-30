import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { create } from "zustand"

type Flight = { id: string; src: string | null; from: DOMRect; to: DOMRect }

const useFlights = create<{
  flights: Flight[]
  /** Bumped when a flight lands, so the cart badge can pop. */
  landed: number
  launch: (flight: Flight) => void
  land: (id: string) => void
}>()((set) => ({
  flights: [],
  landed: 0,
  launch: (flight) => set((state) => ({ flights: [...state.flights, flight] })),
  land: (id) =>
    set((state) => ({
      flights: state.flights.filter((f) => f.id !== id),
      landed: state.landed + 1,
    })),
}))

export const useLanded = () => useFlights((state) => state.landed)

/** Send a thumbnail from `source` to the element marked data-cart-target. */
export function flyToCart(source: Element | null, src: string | null) {
  const target = document.querySelector("[data-cart-target]")
  if (!source || !target) {
    useFlights.setState((state) => ({ landed: state.landed + 1 }))
    return
  }
  useFlights.getState().launch({
    id: crypto.randomUUID(),
    src,
    from: source.getBoundingClientRect(),
    to: target.getBoundingClientRect(),
  })
}

/** The thumbnails in the air. Mounted once per order screen. */
export function FlightLayer() {
  const flights = useFlights((state) => state.flights)
  const land = useFlights((state) => state.land)
  const reduce = useReducedMotion()

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40">
      <AnimatePresence>
        {flights.map((flight) => {
          const size = 56
          const startX = flight.from.left + flight.from.width / 2 - size / 2
          const startY = flight.from.top + flight.from.height / 2 - size / 2
          const endX = flight.to.left + flight.to.width / 2 - size / 2
          const endY = flight.to.top + flight.to.height / 2 - size / 2
          return (
            <motion.div
              key={flight.id}
              className="absolute top-0 left-0 size-14 overflow-hidden rounded-2xl bg-accent shadow-(--shadow-overlay)"
              initial={{ x: startX, y: startY, scale: 1.4, opacity: 1 }}
              animate={
                reduce
                  ? { x: endX, y: endY, scale: 0.4, opacity: 0 }
                  : {
                      x: [startX, (startX + endX) / 2, endX],
                      y: [startY, Math.min(startY, endY) - 80, endY],
                      scale: [1.4, 1, 0.35],
                      opacity: [1, 1, 0.6],
                    }
              }
              transition={{
                duration: reduce ? 0.01 : 0.55,
                ease: [0.22, 1, 0.36, 1],
              }}
              onAnimationComplete={() => land(flight.id)}
            >
              {flight.src && (
                <img
                  src={flight.src}
                  alt=""
                  className="size-full object-cover"
                />
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
