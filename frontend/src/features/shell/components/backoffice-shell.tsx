import { Link, Outlet, useRouterState } from "@tanstack/react-router"
import { ArrowLeftIcon, StoreIcon } from "lucide-react"
import { motion } from "motion/react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button.tsx"
import { sectionOrder } from "@/features/auth/lib/page-catalog.ts"
import { visiblePages } from "@/features/auth/lib/route-access.ts"
import { useSession } from "@/features/auth/store/session-store.ts"
import { useOutletQuery } from "@/features/outlet/hooks/use-outlet.ts"
import { UserMenu } from "@/features/shell/components/user-menu.tsx"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

/**
 * Owner and manager screens. The sidebar lists only the pages the user's
 * roles open, grouped by section; on a portrait tablet it shrinks to icons.
 */
export function BackofficeShell() {
  const { t } = useTranslation()
  const user = useSession((state) => state.user)
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const outlet = useOutletQuery()
  const adminPages = visiblePages(user, "admin")
  const posHome = visiblePages(user, "pos")[0]

  return (
    <div className="flex h-dvh bg-canvas pt-safe">
      <aside className="flex w-20 shrink-0 flex-col border-r bg-sidebar lg:w-64">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <StoreIcon className="size-5" />
          </span>
          <span className="hidden truncate font-heading font-semibold lg:block">
            {outlet.data?.name}
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {sectionOrder.map((section) => {
            const items = adminPages.filter((page) => page.section === section)
            if (items.length === 0) return null
            return (
              <div key={section} className="mb-4">
                <p className="mb-1 hidden px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase lg:block">
                  {t(`section.${section}`)}
                </p>
                {items.map((page) => {
                  const active = pathname.startsWith(page.path)
                  const Icon = page.icon
                  return (
                    <Link
                      key={page.key}
                      to={page.path}
                      title={t(`nav.${page.key}`)}
                      className={cn(
                        "relative flex h-12 items-center justify-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:justify-start",
                        active
                          ? "text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="admin-nav"
                          transition={spring.layout}
                          className="absolute inset-0 rounded-xl bg-sidebar-accent"
                        />
                      )}
                      <Icon className="relative size-5 shrink-0" />
                      <span className="relative hidden truncate lg:inline">
                        {t(`nav.${page.key}`)}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>
        {posHome && (
          <div className="border-t p-3">
            <Button
              asChild
              variant="secondary"
              size="touch"
              className="w-full px-0 lg:px-5"
            >
              <Link to={posHome.path} title={t("nav.pos")}>
                <ArrowLeftIcon />
                <span className="hidden lg:inline">{t("nav.pos")}</span>
              </Link>
            </Button>
          </div>
        )}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-end border-b bg-background/85 px-4 backdrop-blur-md">
          <UserMenu />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
