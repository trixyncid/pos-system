import { authHandlers } from "@/mocks/handlers/auth.ts"
import { outletHandlers } from "@/mocks/handlers/outlet.ts"

export const handlers = [...authHandlers, ...outletHandlers]
