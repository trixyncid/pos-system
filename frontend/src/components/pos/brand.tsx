import { useId } from "react"

import { cn } from "@/lib/utils.ts"

/** The outlet's identity. The name shown in the app comes from Settings; this is the mark and the fallback. */
export const BRAND = {
  name: "Yi Ci Pang",
  hanzi: "一級棒",
  logo: "/brand/yicipang-192.webp",
  logoLarge: "/brand/yicipang-512.webp",
} as const

/**
 * The chef-and-bowl logo on its own white tile: the artwork has a white
 * ground, so the tile keeps it clean on red, cream and dark surfaces alike.
 */
export function BrandMark({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}) {
  const large = size === "lg" || size === "xl"
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden bg-white ring-1 ring-black/5",
        size === "sm" && "size-9 rounded-xl p-0.5",
        size === "md" && "size-10 rounded-xl p-0.5",
        size === "lg" && "size-16 rounded-2xl p-1",
        size === "xl" && "size-40 rounded-[2rem] p-2 shadow-(--shadow-overlay)",
        className
      )}
    >
      <img
        src={large ? BRAND.logoLarge : BRAND.logo}
        alt={BRAND.name}
        className="size-full object-contain"
        draggable={false}
      />
    </span>
  )
}

/**
 * The key-pattern band from the rim of the logo's bowl, as a repeating
 * border. It inherits `currentColor`.
 */
export function MeanderBand({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg aria-hidden className={cn("h-6 w-full", className)}>
      <defs>
        <pattern id={id} width="24" height="24" patternUnits="userSpaceOnUse">
          <path
            d="M0 21H21V3H6V15H15V9H11"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="square"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}
