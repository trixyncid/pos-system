import { authHandlers } from "@/mocks/handlers/auth.ts"
import { backofficeHandlers } from "@/mocks/handlers/backoffice.ts"
import { catalogHandlers } from "@/mocks/handlers/catalog.ts"
import { displayHandlers } from "@/mocks/handlers/display.ts"
import { floorHandlers } from "@/mocks/handlers/floor.ts"
import { inventoryHandlers } from "@/mocks/handlers/inventory.ts"
import { orderHandlers } from "@/mocks/handlers/orders.ts"
import { outletHandlers } from "@/mocks/handlers/outlet.ts"
import { promoHandlers } from "@/mocks/handlers/promos.ts"
import { reportHandlers } from "@/mocks/handlers/reports.ts"
import { shiftHandlers } from "@/mocks/handlers/shifts.ts"

export const handlers = [
  ...authHandlers,
  ...outletHandlers,
  ...backofficeHandlers,
  ...catalogHandlers,
  ...floorHandlers,
  ...orderHandlers,
  ...shiftHandlers,
  ...inventoryHandlers,
  ...reportHandlers,
  ...promoHandlers,
  ...displayHandlers,
]
