import { Outlet, useNavigate } from "@tanstack/react-router"
import { WifiOffIcon } from "lucide-react"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button.tsx"
import { useSession } from "@/features/auth/store/session-store.ts"
import { useRealtime } from "@/realtime/use-realtime.ts"

function Unreachable() {
  const { t } = useTranslation()
  const hydrate = useSession((state) => state.hydrate)
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-6 text-center">
      <div className="max-w-sm space-y-4">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-warning/15 text-warning-ink">
          <WifiOffIcon className="size-7" />
        </span>
        <p className="text-muted-foreground">
          Server tidak terjangkau. Periksa Wi-Fi tablet.
        </p>
        <Button size="touch" onClick={() => void hydrate()}>
          {t("common.retry")}
        </Button>
      </div>
    </main>
  )
}

/** Every signed-in screen sits under this. */
export function AppGate() {
  const status = useSession((state) => state.status)
  const navigate = useNavigate()
  useRealtime()

  // Signing out (or the API ending the session) leaves the signed-in screens.
  useEffect(() => {
    if (status === "signed-out") void navigate({ to: "/login", replace: true })
  }, [status, navigate])

  if (status === "unreachable") return <Unreachable />
  return <Outlet />
}
