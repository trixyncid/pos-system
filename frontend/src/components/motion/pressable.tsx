import { motion, type HTMLMotionProps } from "motion/react"

import { spring } from "@/lib/motion.ts"

/**
 * A button that sinks a little under the finger and springs back. Use it for
 * tap targets that are not shadcn Buttons: menu cards, table tiles, keypad keys.
 */
export function Pressable({
  pressScale = 0.96,
  type = "button",
  ...props
}: HTMLMotionProps<"button"> & { pressScale?: number }) {
  return (
    <motion.button
      type={type}
      whileTap={props.disabled ? undefined : { scale: pressScale }}
      transition={spring.press}
      {...props}
    />
  )
}
