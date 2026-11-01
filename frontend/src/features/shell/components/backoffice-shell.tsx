import { Link, Outlet, useRouterState } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
} from "lucide-react"
import { motion } from "motion/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { BRAND, BrandMark } from "@/components/pos/brand.tsx"
import { Button } from "@/components/ui/button.tsx"
import { sectionOrder } from "@/features/auth/lib/page-catalog.ts"
import { visiblePages } from "@/features/auth/lib/route-access.ts"
import { useSession } from "@/features/auth/store/session-store.ts"
import { useOutletQuery } from "@/features/outlet/hooks/use-outlet.ts"
import {
  LanguageMenu,
  ThemeSwitch,
} from "@/features/shell/components/preferences.tsx"
import { UserMenu } from "@/features/shell/components/user-menu.tsx"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

const collapsedKey = "pos.sidebar.collapsed"

function storedCollapsed() {
  try {
    return window.localStorage.getItem(collapsedKey) === "1"
  } catch {
    return false
  }
}

/**
 * Owner and manager screens. The sidebar lists only the pages the user's
 * roles open, grouped by section. It shrinks to icons on a portrait tablet,
 * and on a wide one the user can collapse it for more room (remembered).
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
  const [collapsed, setCollapsed] = useState(storedCollapsed)
  // Labels show on wide screens unless the user collapsed the sidebar.
  const wide = collapsed ? "hidden" : "hidden lg:block"
  const wideInline = collapsed ? "hidden" : "hidden lg:inline"

  const toggle = () =>
    setCollapsed((current) => {
      try {
        window.localStorage.setItem(collapsedKey, current ? "0" : "1")
      } catch {
        // Not remembered in private mode; the toggle still works.
      }
      return !current
    })

  return (
    <div className="flex h-dvh bg-canvas pt-safe">
      <aside
        className={cn(
          "flex w-20 shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200 ease-out",
          !collapsed && "lg:w-64"
        )}
      >
        <div className="flex h-16 items-center gap-2.5 px-5">
          <BrandMark />
          <span className={cn("truncate font-heading font-semibold", wide)}>
            {outlet.data?.name ?? BRAND.name}
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {sectionOrder.map((section) => {
            const items = adminPages.filter((page) => page.section === section)
            if (items.length === 0) return null
            return (
              <div key={section} className="mb-4">
                <p
                  className={cn(
                    "mb-1 px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase",
                    wide
                  )}
                >
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
                        "relative flex h-12 items-center justify-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        !collapsed && "lg:justify-start",
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
                      <span className={cn("relative truncate", wideInline)}>
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
              className={cn("w-full px-0", !collapsed && "lg:px-5")}
            >
              <Link to={posHome.path} title={t("nav.pos")}>
                <ArrowLeftIcon />
                <span className={wideInline}>{t("nav.pos")}</span>
              </Link>
            </Button>
          </div>
        )}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-end gap-2 border-b bg-background/85 px-4 backdrop-blur-md">
          <Button
            variant="ghost"
            size="icon-touch"
            className="mr-auto hidden lg:inline-flex"
            aria-label={t(
              collapsed ? "nav.expandSidebar" : "nav.collapseSidebar"
            )}
            aria-expanded={!collapsed}
            onClick={toggle}
          >
            {collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
          </Button>
          <LanguageMenu />
          <ThemeSwitch />
          <UserMenu />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
