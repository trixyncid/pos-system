import { authHandlers } from "@/mocks/handlers/auth.ts"
import { backofficeHandlers } from "@/mocks/handlers/backoffice.ts"
import { catalogHandlers } from "@/mocks/handlers/catalog.ts"
import { floorHandlers } from "@/mocks/handlers/floor.ts"
import { outletHandlers } from "@/mocks/handlers/outlet.ts"

export const handlers = [
  ...authHandlers,
  ...outletHandlers,
  ...backofficeHandlers,
  ...catalogHandlers,
  ...floorHandlers,
]
