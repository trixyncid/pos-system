import { setupWorker } from "msw/browser"

import { handlers } from "@/mocks/handlers/index.ts"

export const worker = setupWorker(...handlers)

export function startMocks() {
  return worker.start({
    // Fonts, images and Vite modules go to the network; only API calls must be mocked.
    onUnhandledRequest(request, print) {
      if (new URL(request.url).pathname.startsWith("/api/")) print.warning()
    },
  })
}
