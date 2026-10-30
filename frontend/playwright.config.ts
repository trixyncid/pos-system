import { defineConfig } from "@playwright/test"

// The POS runs on tablets, so every flow is checked at the two sizes we ship for.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://localhost:3000",
    hasTouch: true,
    trace: "on-first-retry",
  },
  projects: [
    { name: "ipad-landscape", use: { viewport: { width: 1180, height: 820 } } },
    {
      name: "android-landscape",
      use: { viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: "bun run dev:mock",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
})
