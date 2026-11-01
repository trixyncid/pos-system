import { ChevronDownIcon, LogOutIcon, MonitorIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { StaffAvatar } from "@/components/pos/staff-avatar.tsx"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx"
import { useCan } from "@/features/auth/hooks/use-can.ts"
import { perm } from "@/features/auth/lib/permissions.ts"
import { useSession } from "@/features/auth/store/session-store.ts"
import { PairDisplaySheet } from "@/features/display/components/pair-display-sheet.tsx"
import { usePairedDisplay } from "@/features/display/api/display.ts"

/** Who is signed in, the customer display link for cashiers, and Sign out. */
export function UserMenu() {
  const { t } = useTranslation()
  const user = useSession((state) => state.user)
  const signOut = useSession((state) => state.signOut)
  const canPay = useCan(perm.takePayment)
  const paired = usePairedDisplay((state) => state.paired)
  const [displayOpen, setDisplayOpen] = useState(false)
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
        {canPay && (
          <DropdownMenuItem
            className="h-11"
            onSelect={() => setDisplayOpen(true)}
          >
            <MonitorIcon />
            <span className="flex-1">{t("display.menu")}</span>
            {paired && <span className="size-2 rounded-full bg-success" />}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="h-11"
          variant="destructive"
          onSelect={() =>
            void signOut().then(() => toast.success(t("auth.signedOut")))
          }
        >
          <LogOutIcon />
          {t("common.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
      <PairDisplaySheet
        open={displayOpen}
        onClose={() => setDisplayOpen(false)}
      />
    </DropdownMenu>
  )
}
