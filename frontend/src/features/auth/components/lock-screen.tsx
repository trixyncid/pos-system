import { useQuery } from "@tanstack/react-query"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { LogOutIcon, StoreIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Pressable } from "@/components/motion/pressable.tsx"
import { NumPad } from "@/components/pos/num-pad.tsx"
import { StaffAvatar } from "@/components/pos/staff-avatar.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import { authKeys, listLockStaff } from "@/features/auth/api/auth.ts"
import { PinDots } from "@/features/auth/components/pin-dots.tsx"
import { canAccessPath, homePath } from "@/features/auth/lib/route-access.ts"
import type { LockStaff } from "@/features/auth/schemas/auth.ts"
import { useSession } from "@/features/auth/store/session-store.ts"
import { useOutletQuery } from "@/features/outlet/hooks/use-outlet.ts"
import { apiErrorCode, apiErrorMessage } from "@/lib/api-error.ts"
import { spring } from "@/lib/motion.ts"
import { useNow } from "@/lib/use-now.ts"
import { cn } from "@/lib/utils.ts"

// The API accepts 4 to 6 digits; the mock and seeded staff use 4. Submits on the 4th digit
// unless more are typed within a moment, so 6-digit PINs still work.
const MIN_PIN = 4
const MAX_PIN = 6
const SUBMIT_PAUSE_MS = 450

const timeFormat = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
})
const dateFormat = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
})

function PinPanel({
  member,
  onCancel,
}: {
  member: LockStaff
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const unlock = useSession((state) => state.unlock)
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [locked, setLocked] = useState(false)

  const submit = useCallback(
    async (value: string) => {
      setBusy(true)
      try {
        const user = await unlock(member.id, value)
        // Stay on the current screen if this person may see it; otherwise go to their own start screen.
        if (pathname === "/forbidden" || !canAccessPath(user, pathname))
          await navigate({ to: homePath(user), replace: true })
      } catch (err) {
        const code = apiErrorCode(err)
        setError(
          code === "pin_incorrect"
            ? t("auth.pinIncorrect")
            : code === "pin_locked"
              ? t("auth.pinLocked")
              : code === "pin_unavailable"
                ? t("auth.pinUnavailable")
                : apiErrorMessage(err)
        )
        setLocked(code === "pin_locked")
        setAttempt((n) => n + 1)
        setPin("")
      } finally {
        setBusy(false)
      }
    },
    [member.id, navigate, pathname, t, unlock]
  )

  // A pending auto-submit, cancelled when another key comes in.
  const submitTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(submitTimer.current), [])

  const onDigit = useCallback(
    (digit: string) => {
      window.clearTimeout(submitTimer.current)
      if (pin.length >= MAX_PIN) return
      const next = pin + digit
      setError(null)
      setPin(next)
      if (next.length >= MAX_PIN) void submit(next)
      else if (next.length >= MIN_PIN)
        submitTimer.current = window.setTimeout(
          () => void submit(next),
          SUBMIT_PAUSE_MS
        )
    },
    [pin, submit]
  )
  const onBackspace = useCallback(() => {
    window.clearTimeout(submitTimer.current)
    setPin((current) => current.slice(0, -1))
  }, [])

  return (
    <motion.div
      key={member.id}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={spring.sheet}
      className="flex w-full max-w-xs flex-col items-center"
    >
      <StaffAvatar name={member.full_name} size="lg" />
      <p className="mt-3 font-heading text-xl font-semibold">
        {member.full_name}
      </p>
      <p className="text-sm text-muted-foreground">{member.role}</p>

      <div className="mt-8 h-6">
        {busy ? (
          <Spinner className="size-5 text-primary" />
        ) : (
          <PinDots
            length={Math.max(MIN_PIN, pin.length)}
            filled={pin.length}
            error={Boolean(error)}
            attempt={attempt}
          />
        )}
      </div>
      <p
        role="alert"
        className="mt-3 min-h-10 text-center text-sm text-balance text-danger-ink"
      >
        {error}
      </p>

      <NumPad
        className="mt-2 w-full"
        keyboard
        disabled={busy || locked}
        onDigit={onDigit}
        onBackspace={onBackspace}
        deleteLabel={t("auth.deleteDigit")}
        bottomLeft={{
          label: t("auth.changeStaff"),
          content: t("common.cancel"),
          onPress: onCancel,
        }}
      />
    </motion.div>
  )
}

/**
 * Full-screen cover over a signed-in tablet. The screen underneath keeps its
 * state, so the next person continues where the last one stopped.
 */
export function LockScreen() {
  const { t } = useTranslation()
  const now = useNow()
  const signOut = useSession((state) => state.signOut)
  const outlet = useOutletQuery()
  const staff = useQuery({
    queryKey: authKeys.lockStaff(),
    queryFn: ({ signal }) => listLockStaff(signal),
    staleTime: 5 * 60_000,
  })
  const [selected, setSelected] = useState<LockStaff | null>(null)

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={t("auth.lockedTitle")}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-50 grid bg-canvas pt-safe pb-safe md:grid-cols-[1fr_420px]"
    >
      <section className="flex min-h-0 flex-col p-6 md:p-10">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="font-heading text-5xl font-semibold tracking-tight tabular-nums">
              {timeFormat.format(now)}
            </p>
            <p className="mt-1 text-muted-foreground capitalize">
              {dateFormat.format(now)}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-card px-4 py-2 shadow-(--shadow-soft)">
            <StoreIcon className="size-4 text-primary" />
            <span className="text-sm font-medium">
              {outlet.data?.name ?? "…"}
            </span>
          </div>
        </header>

        <h1 className="mt-10 font-heading text-2xl font-semibold">
          {t("auth.lockedTitle")}
        </h1>
        <p className="text-muted-foreground">{t("auth.lockedBody")}</p>

        <div className="mt-6 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
          {staff.isPending ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-20 rounded-2xl" />
              ))}
            </div>
          ) : staff.isError ? (
            <p className="text-danger-ink">{apiErrorMessage(staff.error)}</p>
          ) : staff.data.length === 0 ? (
            <p className="text-muted-foreground">{t("auth.noStaffWithPin")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {staff.data.map((member, index) => {
                const active = selected?.id === member.id
                return (
                  <Pressable
                    key={member.id}
                    onClick={() => setSelected(member)}
                    aria-pressed={active}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring.layout, delay: index * 0.03 }}
                    className={cn(
                      "relative flex min-h-20 items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-(--shadow-soft) outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="lock-selected"
                        transition={spring.layout}
                        className="absolute inset-0 rounded-2xl ring-2 ring-primary"
                      />
                    )}
                    <StaffAvatar name={member.full_name} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {member.full_name}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {member.role}
                      </span>
                    </span>
                  </Pressable>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <Button variant="ghost" size="touch" onClick={() => void signOut()}>
            <LogOutIcon />
            {t("common.signOut")}
          </Button>
        </div>
      </section>

      <section className="flex items-center justify-center border-t bg-card/60 p-6 md:border-t-0 md:border-l md:p-10">
        <AnimatePresence mode="wait" initial={false}>
          {selected ? (
            <PinPanel
              key={selected.id}
              member={selected}
              onCancel={() => setSelected(null)}
            />
          ) : (
            <motion.p
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-56 text-center text-muted-foreground"
            >
              {t("auth.lockedBody")}
            </motion.p>
          )}
        </AnimatePresence>
      </section>
    </motion.div>
  )
}
