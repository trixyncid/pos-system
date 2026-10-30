import type { Columns, TicketDoc } from "@/features/printing/lib/ticket-doc.ts"
import { row } from "@/features/printing/lib/ticket-doc.ts"
import { cn } from "@/lib/utils.ts"

/**
 * A ticket drawn as the thermal printer would print it: monospaced, fixed
 * width in characters, black on paper. Used in development (the preview
 * transport) and wherever staff check what was sent.
 */
export function TicketPreview({
  doc,
  columns,
  className,
}: {
  doc: TicketDoc
  columns: Columns
  className?: string
}) {
  return (
    <div
      className={cn(
        "bg-[#fffdf9] px-3 py-4 font-mono text-[11px] leading-[1.4] text-neutral-900 shadow-(--shadow-soft)",
        className
      )}
      // One character cell per column, so wrapping matches the printer.
      style={{ width: `calc(${columns}ch + 1.5rem)` }}
    >
      {doc.map((block, index) => {
        switch (block.type) {
          case "text":
            return (
              <p
                key={index}
                className={cn(
                  "whitespace-pre-wrap",
                  block.align === "center" && "text-center",
                  block.align === "right" && "text-right",
                  block.bold && "font-bold",
                  block.size === 2 && "text-[22px] leading-tight",
                  block.size === "tall" && "origin-left scale-y-[1.6] py-[3px]"
                )}
              >
                <span
                  className={
                    block.invert
                      ? "bg-neutral-900 px-1 text-[#fffdf9]"
                      : undefined
                  }
                >
                  {block.text}
                </span>
              </p>
            )
          case "row":
            return (
              <p
                key={index}
                className={cn("whitespace-pre", block.bold && "font-bold")}
              >
                {row(block.left, block.right, columns)}
              </p>
            )
          case "rule":
            return (
              <p
                key={index}
                aria-hidden
                className="overflow-hidden whitespace-pre"
              >
                {"-".repeat(columns)}
              </p>
            )
          case "feed":
            return (
              <div key={index} style={{ height: `${block.lines * 1.4}em` }} />
            )
        }
      })}
    </div>
  )
}
