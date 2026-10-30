/**
 * How bytes reach a printer. The print station picks one transport; the rest
 * of the app never knows which.
 *
 * - PreviewTransport: development and mock mode. "Prints" by keeping the
 *   bytes, which the station shows as an on-screen ticket.
 * - CapacitorTcpTransport (M10): the Android app opens a raw socket to the
 *   LAN printer on port 9100.
 */
export interface PrintTransport {
  readonly name: string
  print(bytes: Uint8Array): Promise<void>
  status(): Promise<"ready" | "offline">
}

export class PreviewTransport implements PrintTransport {
  readonly name = "Preview"
  readonly printed: Uint8Array[] = []

  async print(bytes: Uint8Array) {
    // A short pause, like a real printer, so the queue animation is visible.
    await new Promise((resolve) => setTimeout(resolve, 350))
    this.printed.push(bytes)
  }

  async status() {
    return "ready" as const
  }
}
