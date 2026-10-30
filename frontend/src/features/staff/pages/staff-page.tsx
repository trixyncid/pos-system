import {
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  SearchIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useDeferredValue, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageHeader } from "@/components/backoffice/page-header.tsx"
import { Segmented } from "@/components/pos/segmented.tsx"
import { StaffAvatar } from "@/components/pos/staff-avatar.tsx"
import { StatusPill } from "@/components/pos/status-pill.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { useSession } from "@/features/auth/store/session-store.ts"
import {
  useSetActive,
  useStaffQuery,
  type StaffListParams,
} from "@/features/staff/api/staff.ts"
import { StaffFormSheet } from "@/features/staff/components/staff-form-sheet.tsx"
import type { Staff } from "@/features/staff/schemas/staff.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { spring } from "@/lib/motion.ts"
import { cn } from "@/lib/utils.ts"

type Filter = "true" | "false" | "all"

const seen = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

function StaffRow({
  member,
  isSelf,
  onEdit,
}: {
  member: Staff
  isSelf: boolean
  onEdit: () => void
}) {
  const { t } = useTranslation()
  const setActive = useSetActive()

  const toggleActive = async () => {
    const is_active = !member.is_active
    await setActive.mutateAsync({ id: member.id, is_active })
    toast.success(
      t(is_active ? "staff.activated" : "staff.deactivated", {
        name: member.full_name,
      })
    )
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={spring.layout}
      className={cn(
        "flex items-center gap-4 rounded-2xl bg-card p-3 pr-2 shadow-(--shadow-soft)",
        !member.is_active && "opacity-60"
      )}
    >
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 items-center gap-4 rounded-xl p-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <StaffAvatar name={member.full_name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{member.full_name}</span>
          <span className="block truncate text-sm text-muted-foreground">
            @{member.username}
            {" · "}
            {member.last_login
              ? t("staff.lastSeen", {
                  when: seen.format(new Date(member.last_login)),
                })
              : t("staff.never")}
          </span>
        </span>
        <span className="hidden flex-wrap justify-end gap-1.5 md:flex">
          {member.role_names.map((name) => (
            <StatusPill key={name} tone="accent">
              {name}
            </StatusPill>
          ))}
          {!member.is_active ? (
            <StatusPill>{t("staff.inactive")}</StatusPill>
          ) : !member.can_sign_in ? (
            <StatusPill tone="warning">{t("staff.noPassword")}</StatusPill>
          ) : null}
        </span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-touch"
            aria-label={t("staff.edit")}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem className="h-11" onSelect={onEdit}>
            <PencilIcon />
            {t("staff.edit")}
          </DropdownMenuItem>
          {!isSelf && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="h-11"
                variant={member.is_active ? "destructive" : "default"}
                onSelect={() => void toggleActive()}
              >
                <PowerIcon />
                {member.is_active ? t("staff.deactivate") : t("staff.activate")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.li>
  )
}

export function StaffPage() {
  const { t } = useTranslation()
  const selfId = useSession((state) => state.user?.id)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<Filter>("true")
  const [editing, setEditing] = useState<Staff | null | undefined>(undefined)

  const params: StaffListParams = {
    search: useDeferredValue(search.trim()) || undefined,
    active: filter === "all" ? undefined : filter,
  }
  const staff = useStaffQuery(params)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <PageHeader
        title={t("staff.title")}
        description={t("staff.subtitle")}
        actions={
          <Button size="touch" onClick={() => setEditing(null)}>
            <PlusIcon />
            {t("staff.add")}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("staff.search")}
            aria-label={t("staff.search")}
            className="h-12 rounded-xl pl-12 text-base"
          />
        </div>
        <Segmented
          label={t("staff.title")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "true", label: t("staff.active") },
            { value: "false", label: t("staff.inactive") },
            { value: "all", label: t("staff.all") },
          ]}
        />
      </div>

      {staff.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-18 rounded-2xl" />
          ))}
        </div>
      ) : staff.isError ? (
        <p className="text-danger-ink">{apiErrorMessage(staff.error)}</p>
      ) : staff.data.results.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          {t("staff.empty")}
        </p>
      ) : (
        <ul
          className={cn(
            "space-y-3 transition-opacity",
            staff.isPlaceholderData && "opacity-60"
          )}
        >
          <AnimatePresence initial={false}>
            {staff.data.results.map((member) => (
              <StaffRow
                key={member.id}
                member={member}
                isSelf={member.id === selfId}
                onEdit={() => setEditing(member)}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}

      <StaffFormSheet member={editing} onClose={() => setEditing(undefined)} />
    </div>
  )
}
