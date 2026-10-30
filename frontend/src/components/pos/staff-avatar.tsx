import { cn } from "@/lib/utils.ts"

// Warm, distinct hues; a name always gets the same one, so staff learn their colour.
const hues = [42, 160, 250, 85, 320, 20, 200, 120]

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.charAt(0) ?? "?"
  const last = parts.length > 1 ? (parts.at(-1)?.charAt(0) ?? "") : ""
  return (first + last).toUpperCase()
}

function hueFor(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hues[hash % hues.length] ?? hues[0]
}

export function StaffAvatar({
  name,
  size = "default",
  className,
}: {
  name: string
  size?: "sm" | "default" | "lg"
  className?: string
}) {
  const hue = hueFor(name)
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-heading font-semibold",
        size === "sm" && "size-8 text-xs",
        size === "default" && "size-10 text-sm",
        size === "lg" && "size-16 text-xl",
        className
      )}
      style={{
        backgroundColor: `oklch(0.92 0.05 ${hue})`,
        color: `oklch(0.38 0.1 ${hue})`,
      }}
    >
      {initials(name)}
    </span>
  )
}
