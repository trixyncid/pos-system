import { useSession } from "@/features/auth/store/session-store.ts"
import { resetMockAuth } from "@/mocks/handlers/auth.ts"
import { apiErrorCode } from "@/lib/api-error.ts"
import { clearSession } from "@/lib/session.ts"

const owner = { email: "owner@warungsenja.test", password: "demo1234" }

function reset() {
  resetMockAuth()
  clearSession()
  useSession.setState({ status: "checking", user: null })
}

describe("session store", () => {
  beforeEach(reset)

  it("starts signed out without a session", async () => {
    await useSession.getState().hydrate()
    expect(useSession.getState().status).toBe("signed-out")
  })

  it("signs in, locks, and hands the tablet to another staff member by PIN", async () => {
    const signedIn = await useSession.getState().signIn(owner)
    expect(signedIn.full_name).toBe("Rina Wijaya")
    expect(useSession.getState().status).toBe("active")

    useSession.getState().lock()
    expect(useSession.getState().status).toBe("locked")

    const error = await useSession
      .getState()
      .unlock(4, "0000")
      .catch((e: unknown) => e)
    expect(apiErrorCode(error)).toBe("pin_incorrect")
    expect(useSession.getState().status).toBe("locked")

    const waiter = await useSession.getState().unlock(4, "4444")
    expect(waiter.full_name).toBe("Sari Lestari")
    expect(useSession.getState()).toMatchObject({
      status: "active",
      user: { id: 4 },
    })
  })

  it("restores a session after reload as locked", async () => {
    await useSession.getState().signIn(owner)
    // A reload: memory is gone, the refresh cookie (mocked) and hint remain.
    useSession.setState({ status: "checking", user: null })
    await useSession.getState().hydrate()
    expect(useSession.getState()).toMatchObject({
      status: "locked",
      user: { id: 1 },
    })
  })

  it("rejects a wrong password with the API's message", async () => {
    await expect(
      useSession.getState().signIn({ ...owner, password: "nope" })
    ).rejects.toMatchObject({ response: { status: 401 } })
    expect(useSession.getState().status).toBe("checking")
  })

  it("signs out", async () => {
    await useSession.getState().signIn(owner)
    await useSession.getState().signOut()
    expect(useSession.getState()).toMatchObject({
      status: "signed-out",
      user: null,
    })
  })
})
