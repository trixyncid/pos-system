import { ShieldOffIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button.tsx"
import { useSession } from "@/features/auth/store/session-store.ts"

export function ForbiddenPage() {
  const { t } = useTranslation()
  const signOut = useSession((state) => state.signOut)
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-6 text-center">
      <div className="max-w-sm space-y-4">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-danger/10 text-danger-ink">
          <ShieldOffIcon className="size-7" />
        </span>
        <h1 className="font-heading text-2xl font-semibold">
          {t("errors.forbiddenTitle")}
        </h1>
        <p className="text-muted-foreground">{t("errors.forbiddenBody")}</p>
        <Button size="touch" onClick={() => void signOut()}>
          {t("auth.switchAccount")}
        </Button>
      </div>
    </main>
  )
}
