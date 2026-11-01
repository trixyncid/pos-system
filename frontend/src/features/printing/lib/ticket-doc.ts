import ReceiptPrinterEncoder from "@point-of-sale/receipt-printer-encoder"

/**
 * A ticket as a list of blocks. Templates build one; `encode` turns it into
 * ESC/POS bytes for the printer and <TicketPreview> draws the same blocks
 * on screen, so the preview is exactly what prints.
 */
export type Block =
  | {
      type: "text"
      text: string
      align?: "left" | "center" | "right"
      bold?: boolean
      /** 2 = double width and height; "tall" = double height only. */
      size?: 1 | 2 | "tall"
      invert?: boolean
    }
  | { type: "row"; left: string; right: string; bold?: boolean }
  | { type: "rule" }
  | { type: "feed"; lines: number }

export type TicketDoc = Block[]

/** Characters per line: 48 on 80 mm paper, 32 on 58 mm. */
export type Columns = 32 | 48

/** "left ........ right" padded to the line width. Long left text is cut to keep the right column. */
export function row(left: string, right: string, columns: number) {
  const space = Math.max(1, columns - right.length - left.length)
  const leftText =
    left.length + right.length + 1 > columns
      ? left.slice(0, columns - right.length - 2) + "…"
      : left
  return leftText + " ".repeat(Math.max(1, space)) + right
}

/** Words wrapped to `width`, so long item names break on spaces, not mid-word. */
export function wrap(text: string, width: number) {
  const lines: string[] = []
  let current = ""
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if ((current + " " + word).trim().length > width) {
      if (current) lines.push(current)
      current = word.length > width ? word.slice(0, width) : word
    } else {
      current = (current + " " + word).trim()
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : [""]
}

/** `drawer` adds the pulse that opens a cash drawer wired to this printer. */
export function encode(
  doc: TicketDoc,
  columns: Columns,
  { drawer = false }: { drawer?: boolean } = {}
): Uint8Array {
  const encoder = new ReceiptPrinterEncoder({ language: "esc-pos", columns })
  encoder.initialize().codepage("auto")
  for (const block of doc) {
    switch (block.type) {
      case "text": {
        const size = block.size ?? 1
        encoder
          .align(block.align ?? "left")
          .bold(block.bold ?? false)
          .invert(block.invert ?? false)
          .width(size === 2 ? 2 : 1)
          .height(size === 1 ? 1 : 2)
          .line(block.text)
          .width(1)
          .height(1)
          .bold(false)
          .invert(false)
          .align("left")
        break
      }
      case "row":
        encoder
          .bold(block.bold ?? false)
          .line(row(block.left, block.right, columns))
          .bold(false)
        break
      case "rule":
        encoder.rule()
        break
      case "feed":
        encoder.newline(block.lines)
        break
    }
  }
  encoder.newline(3).cut()
  if (drawer) encoder.pulse()
  return encoder.encode()
}
