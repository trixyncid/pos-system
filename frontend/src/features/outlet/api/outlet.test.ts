import { getOutlet } from "@/features/outlet/api/outlet.ts"
import { outlet } from "@/mocks/db/outlet.ts"

describe("getOutlet", () => {
  it("reads the outlet through the mocked API and validates it", async () => {
    await expect(getOutlet()).resolves.toEqual(outlet)
  })
})
