import { Link, Outlet, useRouterState } from "@tanstack/react-router"
import { BriefcaseBusinessIcon, StoreIcon } from "lucide-react"
import { motion } from "motion/react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button.tsx"
import { visiblePages } from "@/features/auth/lib/route-access.ts"
import { useSession } from "@/features/auth/store/session-store.ts"
import { useOutletQuery } from "@/features/outlet/hooks/use-outlet.ts"
import {
  LanguageMenu,
  ThemeSwitch,
} from "@/features/shell/components/preferences.tsx"
import { UserMenu } from "@/features/shell/components/user-menu.tsx"
import { spring } from "@/lib/motion.ts"
import { useNow } from "@/lib/use-now.ts"
import { cn } from "@/lib/utils.ts"

const clock = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
})

/**
 * The service screens: a slim bar on top and the full rest of the screen for
 * the floor, the order or the snack bar. Built for landscape tablets.
 */
export function PosShell() {
  const { t } = useTranslation()
  const user = useSession((state) => state.user)
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const outlet = useOutletQuery()
  const now = useNow()
  const posPages = visiblePages(user, "pos")
  const adminHome = visiblePages(user, "admin")[0]

  return (
    <div className="flex h-dvh flex-col bg-canvas pt-safe">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-background/85 px-3 backdrop-blur-md sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <StoreIcon className="size-5" />
          </span>
          <span className="hidden truncate font-heading font-semibold xl:block">
            {outlet.data?.name}
          </span>
        </div>

        <nav className="mx-auto flex items-center gap-1 rounded-2xl bg-muted p-1">
          {posPages.map((page) => {
            const active = pathname.startsWith(page.path)
            const Icon = page.icon
            return (
              <Link
                key={page.key}
                to={page.path}
                className={cn(
                  "relative flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-4",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="pos-nav"
                    transition={spring.layout}
                    className="absolute inset-0 rounded-xl bg-background shadow-(--shadow-soft)"
                  />
                )}
                <Icon className="relative size-5" />
                <span className="relative hidden whitespace-nowrap lg:inline">
                  {t(`nav.${page.key}`)}
                </span>
              </Link>
            )
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1 xl:gap-2">
          <span className="hidden font-heading text-lg font-medium tabular-nums xl:block">
            {clock.format(now)}
          </span>
          {adminHome && (
            <Button asChild variant="ghost" size="touch" className="px-3">
              <Link to={adminHome.path} aria-label={t("nav.backOffice")}>
                <BriefcaseBusinessIcon />
                <span className="hidden xl:inline">{t("nav.backOffice")}</span>
              </Link>
            </Button>
          )}
          <LanguageMenu />
          <ThemeSwitch className="hidden md:flex" />
          <UserMenu />
        </div>
      </header>
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
