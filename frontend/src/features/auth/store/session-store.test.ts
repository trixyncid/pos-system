import { useSession } from "@/features/auth/store/session-store.ts"
import { resetMockAuth } from "@/mocks/handlers/auth.ts"
import { clearSession } from "@/lib/session.ts"

const owner = { username: "rina", password: "demo1234" }

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

  it("signs in with a username", async () => {
    const signedIn = await useSession.getState().signIn(owner)
    expect(signedIn).toMatchObject({
      full_name: "Rina Wijaya",
      username: "rina",
    })
    expect(useSession.getState().status).toBe("active")
  })

  it("signs a waiter in to their own account", async () => {
    const waiter = await useSession
      .getState()
      .signIn({ username: "Sari", password: "demo1234" })
    expect(waiter.full_name).toBe("Sari Lestari")
    expect(useSession.getState().user?.permissions).toEqual([
      "accounts.take_order",
    ])
  })

  it("restores a session after reload, still signed in", async () => {
    await useSession.getState().signIn(owner)
    // A reload: memory is gone, the refresh cookie (mocked) and hint remain.
    useSession.setState({ status: "checking", user: null })
    await useSession.getState().hydrate()
    expect(useSession.getState()).toMatchObject({
      status: "active",
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
