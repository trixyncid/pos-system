import { create } from "zustand"

import { getMe, login, logout } from "@/features/auth/api/auth.ts"
import type { LoginInput, User } from "@/features/auth/schemas/auth.ts"
import {
  isSessionEnded,
  markSessionExpired,
  refreshSession,
  resetSessionState,
  setOnUnauthorized,
} from "@/lib/api.ts"
import { queryClient } from "@/lib/query-client.ts"
import { clearSession, hasSessionHint, setSession } from "@/lib/session.ts"

/**
 * Every staff member signs in with their own username and password and stays
 * signed in until they sign out.
 *
 * - `checking`: restoring a session on startup.
 * - `signed-out`: someone needs to sign in.
 * - `active`: `user` is working on the tablet.
 * - `unreachable`: a session may exist but the API could not be reached.
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
  queryClient.clear()
  useSession.setState({ status: "signed-out", user: null })
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
        set({ status: "active", user: await getMe() })
      } catch (error) {
        if (isSessionEnded(error)) endSession()
        else set({ status: "unreachable" })
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
    set({ status: "active", user: session.user })
    return session.user
  },

  async signOut() {
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

setOnUnauthorized(endSession)
