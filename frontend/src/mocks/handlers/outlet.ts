import { http } from "msw"

import { outlet } from "@/mocks/db/outlet.ts"
import { apiPath, ok } from "@/mocks/http.ts"

export const outletHandlers = [http.get(apiPath("/outlet/"), () => ok(outlet))]
