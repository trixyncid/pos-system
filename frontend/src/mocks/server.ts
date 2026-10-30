import { setupServer } from "msw/node"

import { handlers } from "@/mocks/handlers/index.ts"

/** The same handlers as the browser worker, for Vitest. */
export const server = setupServer(...handlers)
