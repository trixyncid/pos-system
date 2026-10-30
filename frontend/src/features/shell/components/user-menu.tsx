import {
  ChevronDownIcon,
  LanguagesIcon,
  LockIcon,
  LogOutIcon,
  MoonIcon,
  SunIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import { StaffAvatar } from "@/components/pos/staff-avatar.tsx"
import { useTheme } from "@/components/theme-provider.tsx"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx"
import { useSession } from "@/features/auth/store/session-store.ts"
import { setLanguage } from "@/lib/i18n.ts"

/** Who is on the tablet, with Lock as the first, biggest action. */
export function UserMenu() {
  const { t, i18n } = useTranslation()
  const user = useSession((state) => state.user)
  const lock = useSession((state) => state.lock)
  const signOut = useSession((state) => state.signOut)
  const { theme, setTheme } = useTheme()
  if (!user) return null
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-12 items-center gap-2 rounded-full py-1 pr-3 pl-1 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted">
        <StaffAvatar name={user.full_name} />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-36 truncate text-sm font-medium">
            {user.full_name}
          </span>
          <span className="block max-w-36 truncate text-xs text-muted-foreground">
            {user.roles.map((role) => role.name).join(", ")}
          </span>
        </span>
        <ChevronDownIcon className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="truncate">
          {user.email ?? user.full_name}
        </DropdownMenuLabel>
        <DropdownMenuItem className="h-11" onSelect={lock}>
          <LockIcon />
          {t("auth.lock")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="h-11"
          onSelect={() => setLanguage(i18n.language === "en" ? "id" : "en")}
        >
          <LanguagesIcon />
          {i18n.language === "en" ? "Bahasa Indonesia" : "English"}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="h-11"
          onSelect={() => setTheme(dark ? "light" : "dark")}
        >
          {dark ? <SunIcon /> : <MoonIcon />}
          {dark ? "Light" : "Dark"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="h-11"
          variant="destructive"
          onSelect={() => void signOut()}
        >
          <LogOutIcon />
          {t("common.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
