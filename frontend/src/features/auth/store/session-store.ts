import { toast } from "sonner"
import { create } from "zustand"

import { getMe, login, logout } from "@/features/auth/api/auth.ts"
import {
  userSchema,
  type LoginInput,
  type User,
} from "@/features/auth/schemas/auth.ts"
import {
  isSessionEnded,
  markSessionExpired,
  refreshSession,
  resetSessionState,
  setOnUnauthorized,
} from "@/lib/api.ts"
import {
  isOfflineError,
  setOnline,
  useConnectivity,
} from "@/lib/connectivity.ts"
import i18n from "@/lib/i18n.ts"
import { clearOfflineCache } from "@/lib/offline-cache.ts"
import { queryClient } from "@/lib/query-client.ts"
import {
  clearSession,
  hasSessionHint,
  rememberedUser,
  rememberUser,
  setSession,
} from "@/lib/session.ts"

/**
 * Every staff member signs in with their own username and password and stays
 * signed in until they sign out.
 *
 * - `checking`: restoring a session on startup.
 * - `signed-out`: someone needs to sign in.
 * - `active`: `user` is working on the tablet.
 * - `unreachable`: a session may exist but the API could not be reached,
 *   and this device doesn't know who was signed in.
 *
 * With no internet at startup, the person last signed in on this device
 * carries on (`active`, no access token): the snack bar sells from the saved
 * products and queues its sales. The session is checked again as soon as
 * the server answers.
 */
export type SessionStatus = "checking" | "signed-out" | "active" | "unreachable"

type SessionState = {
  status: SessionStatus
  user: User | null
  hydrate: () => Promise<void>
  signIn: (input: LoginInput) => Promise<User>
  signOut: () => Promise<void>
}

let hydrating: Promise<void> | null = null

function endSession() {
  clearSession()
  clearOfflineCache()
  queryClient.clear()
  useSession.setState({ status: "signed-out", user: null })
}

function start(user: User) {
  rememberUser(user)
  useSession.setState({ status: "active", user })
}

/** Started offline: once the server answers, get a token and a fresh profile. */
function resumeWhenOnline() {
  const stop = useConnectivity.subscribe(({ online }) => {
    if (!online) return
    stop()
    refreshSession()
      .then(getMe)
      .then(start)
      .catch((error: unknown) => {
        if (isSessionEnded(error)) endSession()
      })
  })
}

export const useSession = create<SessionState>()((set, get) => ({
  status: "checking",
  user: null,

  /** Restore the session after a reload: the same person, still signed in. */
  hydrate() {
    if (get().status !== "checking" && get().status !== "unreachable") {
      return Promise.resolve()
    }
    hydrating ??= (async () => {
      if (!hasSessionHint()) {
        set({ status: "signed-out", user: null })
        return
      }
      try {
        await refreshSession()
        start(await getMe())
      } catch (error) {
        if (isSessionEnded(error)) return endSession()
        const known = userSchema.safeParse(rememberedUser())
        if (known.success && isOfflineError(error)) {
          setOnline(false)
          set({ status: "active", user: known.data })
          resumeWhenOnline()
        } else set({ status: "unreachable" })
      }
    })().finally(() => {
      hydrating = null
    })
    return hydrating
  },

  async signIn(input) {
    const session = await login(input)
    resetSessionState()
    setSession(session.access)
    queryClient.clear()
    start(session.user)
    return session.user
  },

  async signOut() {
    // Signing in again needs the server, so nobody is locked out mid-outage.
    if (!useConnectivity.getState().online) {
      toast.warning(i18n.t("offline.cantSignOut"))
      return
    }
    // Stop refetches first, so nothing signs the tablet back in mid-logout.
    markSessionExpired()
    await queryClient.cancelQueries()
    try {
      await logout()
    } finally {
      endSession()
    }
  },
}))

setOnUnauthorized(() => {
  // Only tell someone who was working; a stale tab at startup just shows sign-in.
  if (useSession.getState().status === "active")
    toast.warning(i18n.t("auth.sessionEnded"))
  endSession()
})
