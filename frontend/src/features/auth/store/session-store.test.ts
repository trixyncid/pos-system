import { http, HttpResponse } from "msw"

import { useSession } from "@/features/auth/store/session-store.ts"
import { setOnline, useConnectivity } from "@/lib/connectivity.ts"
import { resetMockAuth } from "@/mocks/handlers/auth.ts"
import { apiPath } from "@/mocks/http.ts"
import { server } from "@/mocks/server.ts"
import { clearSession } from "@/lib/session.ts"

const owner = { username: "rina", password: "demo1234" }

const noInternet = http.post(apiPath("/auth/refresh/"), () =>
  HttpResponse.error()
)

function reset() {
  resetMockAuth()
  setOnline(true)
  clearSession()
  useSession.setState({ status: "checking", user: null })
}

describe("session store", () => {
  beforeEach(reset)
  afterEach(() => setOnline(true))

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

  it("starts offline as the person last signed in on this device", async () => {
    await useSession.getState().signIn(owner)
    useSession.setState({ status: "checking", user: null })
    server.use(noInternet)
    await useSession.getState().hydrate()
    expect(useSession.getState()).toMatchObject({
      status: "active",
      user: { username: "rina" },
    })
    expect(useConnectivity.getState().online).toBe(false)
    // Signing out now would lock everyone out until the internet is back.
    await useSession.getState().signOut()
    expect(useSession.getState().status).toBe("active")
  })

  it("can't start offline on a device nobody signed in on", async () => {
    await useSession.getState().signIn(owner)
    window.localStorage.removeItem("pos.session.user")
    useSession.setState({ status: "checking", user: null })
    server.use(noInternet)
    await useSession.getState().hydrate()
    expect(useSession.getState().status).toBe("unreachable")
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
