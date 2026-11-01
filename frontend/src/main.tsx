import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"
import { MotionConfig } from "motion/react"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { router } from "@/app/router.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { Toaster } from "@/components/ui/sonner.tsx"
import { env } from "@/lib/env.ts"
import "@/lib/i18n.ts"
import { registerServiceWorker } from "@/lib/pwa.ts"
import { queryClient } from "@/lib/query-client.ts"
import "@/index.css"

async function prepare() {
  if (!env.useMocks) return
  // Loaded only in mock mode, so MSW never ships in a production bundle.
  const { startMocks } = await import("@/mocks/browser.ts")
  try {
    await startMocks()
  } catch (error) {
    // Some embedded browsers refuse service workers. Render anyway: API calls
    // then fail visibly instead of the whole app staying blank.
    console.error("Mock API could not start", error)
  }
}

registerServiceWorker()

void prepare().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ThemeProvider defaultTheme="light">
        <QueryClientProvider client={queryClient}>
          {/* Springs and layout animations step aside when the tablet asks for reduced motion. */}
          <MotionConfig reducedMotion="user">
            <RouterProvider router={router} />
          </MotionConfig>
          <Toaster />
        </QueryClientProvider>
      </ThemeProvider>
    </StrictMode>
  )
})
