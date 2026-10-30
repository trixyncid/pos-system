import { HammerIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { RiseIn } from "@/components/motion/rise-in.tsx"
import { pageByKey, type Page } from "@/features/auth/lib/page-catalog.ts"

/** Stands in for a screen until its milestone builds it. */
export function ComingSoonPage({ pageKey }: { pageKey: Page["key"] }) {
  const { t } = useTranslation()
  const page = pageByKey(pageKey)
  const Icon = page.icon
  return (
    <div className="grid h-full min-h-80 place-items-center p-8">
      <RiseIn className="max-w-sm text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-accent text-accent-foreground">
          <Icon className="size-7" />
        </span>
        <h1 className="mt-5 font-heading text-2xl font-semibold">
          {t(`nav.${page.key}`)}
        </h1>
        <p className="mt-2 flex items-center justify-center gap-2 text-muted-foreground">
          <HammerIcon className="size-4" />
          {t("common.comingSoonBody", { milestone: page.milestone })}
        </p>
      </RiseIn>
    </div>
  )
}
