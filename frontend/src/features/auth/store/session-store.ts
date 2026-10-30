import { create } from "zustand"

import { getMe, login, logout, pinUnlock } from "@/features/auth/api/auth.ts"
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
 * - `checking`: restoring a session on startup.
 * - `signed-out`: the tablet needs a manager's email and password.
 * - `locked`: the tablet holds a session, but whoever uses it must enter a PIN first.
 * - `active`: `user` is working on the tablet.
 * - `unreachable`: a session may exist but the API could not be reached.
 */
export type SessionStatus =
  "checking" | "signed-out" | "locked" | "active" | "unreachable"

type SessionState = {
  status: SessionStatus
  user: User | null
  hydrate: () => Promise<void>
  signIn: (input: LoginInput) => Promise<User>
  unlock: (userId: number, pin: string) => Promise<User>
  lock: () => void
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

  /**
   * Restore the tablet's session after a reload. It comes back locked: a
   * shared tablet must not reopen as whoever used it last.
   */
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
        set({ status: "locked", user: await getMe() })
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

  async unlock(userId, pin) {
    const session = await pinUnlock({ user_id: userId, pin })
    setSession(session.access)
    if (get().user?.id !== session.user.id) queryClient.clear()
    set({ status: "active", user: session.user })
    return session.user
  },

  lock() {
    if (get().status === "active") set({ status: "locked" })
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
