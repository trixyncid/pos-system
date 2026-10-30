import { useState } from "react"

import { cn } from "@/lib/utils.ts"

/**
 * A product photo that fades in over its placeholder (a tiny blurred
 * `placeholder` data URL, or a warm tile with the first letter when there is
 * no photo or it fails to load).
 */
export function ProductImage({
  src,
  alt,
  placeholder,
  className,
  sizes,
  srcSet,
  priority = false,
}: {
  src?: string | null
  alt: string
  placeholder?: string | null
  className?: string
  sizes?: string
  srcSet?: string
  priority?: boolean
}) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading")
  const showPhoto = Boolean(src) && state !== "failed"

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden bg-linear-to-br from-accent to-secondary",
        className
      )}
      style={
        placeholder
          ? {
              backgroundImage: `url(${placeholder})`,
              backgroundSize: "cover",
            }
          : undefined
      }
    >
      {!showPhoto && (
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center font-heading text-4xl font-semibold text-accent-foreground/40"
        >
          {alt.trim().charAt(0).toUpperCase()}
        </span>
      )}
      {showPhoto && (
        <img
          src={src ?? undefined}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          onLoad={() => setState("loaded")}
          onError={() => setState("failed")}
          className={cn(
            "size-full object-cover transition-[opacity,filter,scale] duration-500 ease-(--ease-out)",
            state === "loaded"
              ? "blur-0 scale-100 opacity-100"
              : "scale-105 opacity-0 blur-md"
          )}
        />
      )}
    </div>
  )
}
