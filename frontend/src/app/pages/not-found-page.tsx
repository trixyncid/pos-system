import { Link } from "@tanstack/react-router"

import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button.tsx"

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-6 text-center">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">{t("errors.notFoundTitle")}</h1>
        <Button asChild size="lg">
          <Link to="/">{t("common.back")}</Link>
        </Button>
      </div>
    </main>
  )
}
