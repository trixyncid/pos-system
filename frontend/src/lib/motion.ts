import type { Transition } from "motion/react"

/**
 * The few springs every screen shares, so motion feels like one product.
 * Durations stay short: staff tap hundreds of times a shift and must never
 * wait on an animation.
 */
export const spring = {
  /** Buttons and cards pressing in and out. */
  press: { type: "spring", stiffness: 600, damping: 32, mass: 0.6 },
  /** Elements entering, leaving or reordering (cart lines, toasts). */
  layout: { type: "spring", stiffness: 420, damping: 36 },
  /** Sheets and panels sliding over the screen. */
  sheet: { type: "spring", stiffness: 340, damping: 34 },
  /** Small things that pop (badges, PIN dots). */
  pop: { type: "spring", stiffness: 700, damping: 22 },
} satisfies Record<string, Transition>

export const fade: Transition = { duration: 0.16, ease: [0.22, 1, 0.36, 1] }
