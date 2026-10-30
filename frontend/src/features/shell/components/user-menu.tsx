import { ChevronDownIcon, LogOutIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { StaffAvatar } from "@/components/pos/staff-avatar.tsx"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx"
import { useSession } from "@/features/auth/store/session-store.ts"

/** Who is signed in, and Sign out. */
export function UserMenu() {
  const { t } = useTranslation()
  const user = useSession((state) => state.user)
  const signOut = useSession((state) => state.signOut)
  if (!user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={user.full_name}
        className="flex h-12 items-center gap-2 rounded-full py-1 pr-3 pl-1 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted"
      >
        <StaffAvatar name={user.full_name} />
        <span className="hidden text-left leading-tight xl:block">
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
          {user.full_name}
          <span className="block text-xs font-normal text-muted-foreground">
            @{user.username}
          </span>
        </DropdownMenuLabel>
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
