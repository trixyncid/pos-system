import { useTranslation } from "react-i18next"

import { Pressable } from "@/components/motion/pressable.tsx"
import { NumPad } from "@/components/pos/num-pad.tsx"
import { StaffAvatar } from "@/components/pos/staff-avatar.tsx"
import { PinDots } from "@/features/auth/components/pin-dots.tsx"
import { useApproversQuery } from "@/features/ordering/api/orders.ts"
import { cn } from "@/lib/utils.ts"

export type Approval = { approver: number | null; pin: string }

export const noApproval: Approval = { approver: null, pin: "" }

/** The approver and PIN fields an API call takes, once both are filled in. */
export function approvalBody(approval: Approval) {
  return approval.approver !== null
    ? { approver: approval.approver, approver_pin: approval.pin }
    : {}
}

export const approvalReady = (approval: Approval) =>
  approval.approver !== null && approval.pin.length >= 4

/**
 * A manager standing next to the tablet picks their name and types their
 * PIN. Used when the signed-in user can't void or discount alone.
 */
export function ApprovalPanel({
  value,
  onChange,
  error,
  attempt,
}: {
  value: Approval
  onChange: (value: Approval) => void
  error: boolean
  /** Bumped on each rejected PIN, so the dots shake again. */
  attempt: number
}) {
  const { t } = useTranslation()
  const approvers = useApproversQuery(true)
  const { approver, pin } = value

  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-heading font-semibold">{t("order.approval")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("order.approvalBody")}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {approvers.data?.map((person) => (
          <Pressable
            key={person.id}
            role="radio"
            aria-checked={approver === person.id}
            onClick={() => onChange({ approver: person.id, pin: "" })}
            className={cn(
              "flex h-14 items-center gap-2 rounded-2xl border pr-4 pl-2 text-sm font-medium transition-colors",
              approver === person.id
                ? "border-primary bg-primary/10"
                : "bg-background"
            )}
          >
            <StaffAvatar name={person.full_name} size="sm" />
            {person.full_name}
          </Pressable>
        ))}
      </div>
      {approver !== null && (
        <div className="mx-auto max-w-xs space-y-3 pt-2">
          <PinDots
            length={Math.max(4, pin.length)}
            filled={pin.length}
            error={error}
            attempt={attempt}
          />
          <NumPad
            keyboard
            deleteLabel={t("auth.deleteDigit")}
            onDigit={(digit) =>
              onChange({
                approver,
                pin: pin.length >= 6 ? pin : pin + digit,
              })
            }
            onBackspace={() => onChange({ approver, pin: pin.slice(0, -1) })}
          />
        </div>
      )}
    </section>
  )
}
