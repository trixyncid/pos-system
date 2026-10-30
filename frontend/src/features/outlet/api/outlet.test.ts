import { getOutlet } from "@/features/outlet/api/outlet.ts"
import { useSession } from "@/features/auth/store/session-store.ts"
import { outlet } from "@/mocks/db/outlet.ts"

describe("getOutlet", () => {
  it("reads the outlet through the mocked API and validates it", async () => {
    await useSession
      .getState()
      .signIn({ username: "dimas", password: "demo1234" })
    await expect(getOutlet()).resolves.toEqual(outlet)
  })
})
