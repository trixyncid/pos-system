import { http, HttpResponse } from "msw"

import { outlet } from "@/mocks/db/outlet.ts"
import { bearerStaff } from "@/mocks/handlers/auth.ts"
import { apiPath, fail, ok } from "@/mocks/http.ts"

export const outletHandlers = [
  // The connectivity probe (lib/connectivity.ts).
  http.get("*/health/", () => HttpResponse.json({ status: "ok" })),
  http.get(apiPath("/outlet/"), ({ request }) =>
    bearerStaff(request)
      ? ok(outlet)
      : fail(401, "Authentication credentials were not provided.", {
          code: "not_authenticated",
        })
  ),
]
