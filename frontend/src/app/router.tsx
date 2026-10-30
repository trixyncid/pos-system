import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
  type RouteComponent,
} from "@tanstack/react-router"

import { NotFoundPage } from "@/app/pages/not-found-page.tsx"
import { pages, type Page } from "@/features/auth/lib/page-catalog.ts"
import {
  canAccessPath,
  homePath,
  visiblePages,
} from "@/features/auth/lib/route-access.ts"
import { useSession } from "@/features/auth/store/session-store.ts"
import { AppGate } from "@/features/shell/components/app-gate.tsx"
import { ComingSoonPage } from "@/features/shell/pages/coming-soon-page.tsx"

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: NotFoundPage,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  beforeLoad: async () => {
    await useSession.getState().hydrate()
    const { status, user } = useSession.getState()
    if (status === "active" || status === "locked")
      throw redirect({ to: homePath(user), replace: true })
  },
  component: lazyRouteComponent(
    () => import("@/features/auth/pages/login-page.tsx"),
    "LoginPage"
  ),
})

/**
 * Every signed-in screen. Its guard runs on each navigation: no session goes
 * to /login, and a page the user's roles do not open goes to their start
 * screen (or /forbidden when they have none).
 */
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  beforeLoad: async ({ location }) => {
    await useSession.getState().hydrate()
    const { status, user } = useSession.getState()
    if (status === "signed-out") throw redirect({ to: "/login", replace: true })
    if (!user) return
    if (!canAccessPath(user, location.pathname)) {
      const home = homePath(user)
      throw redirect({
        to: home === location.pathname ? "/forbidden" : home,
        replace: true,
      })
    }
  },
  component: AppGate,
})

const indexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: homePath(useSession.getState().user), replace: true })
  },
})

const forbiddenRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/forbidden",
  component: lazyRouteComponent(
    () => import("@/features/shell/pages/forbidden-page.tsx"),
    "ForbiddenPage"
  ),
})

const posRoute = createRoute({
  getParentRoute: () => appRoute,
  id: "pos",
  component: lazyRouteComponent(
    () => import("@/features/shell/components/pos-shell.tsx"),
    "PosShell"
  ),
})

const adminRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/admin",
  component: lazyRouteComponent(
    () => import("@/features/shell/components/backoffice-shell.tsx"),
    "BackofficeShell"
  ),
})

const adminIndexRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/",
  beforeLoad: () => {
    const first = visiblePages(useSession.getState().user, "admin")[0]
    throw redirect({ to: first?.path ?? "/forbidden", replace: true })
  },
})

/** Screens that are built; every other catalog page shows its placeholder until its milestone. */
const builtPages: Partial<Record<Page["key"], RouteComponent>> = {
  settings: lazyRouteComponent(
    () => import("@/features/settings/pages/settings-page.tsx"),
    "SettingsPage"
  ),
  staff: lazyRouteComponent(
    () => import("@/features/staff/pages/staff-page.tsx"),
    "StaffPage"
  ),
  roles: lazyRouteComponent(
    () => import("@/features/roles/pages/roles-page.tsx"),
    "RolesPage"
  ),
}

function pageRoute(page: Page) {
  const parent = page.shell === "pos" ? posRoute : adminRoute
  return createRoute({
    getParentRoute: () => parent,
    path: page.shell === "pos" ? page.path : page.path.replace("/admin", ""),
    component:
      builtPages[page.key] ?? (() => <ComingSoonPage pageKey={page.key} />),
  })
}

const posPages = pages.filter((page) => page.shell === "pos").map(pageRoute)
const adminPages = pages.filter((page) => page.shell === "admin").map(pageRoute)

// Development only: the design kit at /kit, outside the sign-in guard.
const kitRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/kit",
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/", replace: true })
  },
  component: lazyRouteComponent(
    () => import("@/app/pages/kit-page.tsx"),
    "KitPage"
  ),
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  kitRoute,
  appRoute.addChildren([
    indexRoute,
    forbiddenRoute,
    posRoute.addChildren(posPages),
    adminRoute.addChildren([adminIndexRoute, ...adminPages]),
  ]),
])

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
