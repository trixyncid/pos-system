import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { NumPad } from "@/components/pos/num-pad.tsx"
import { TouchSheet } from "@/components/pos/touch-sheet.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import { PinDots } from "@/features/auth/components/pin-dots.tsx"
import { useSetPin } from "@/features/staff/api/staff.ts"
import type { Staff } from "@/features/staff/schemas/staff.ts"
import { apiErrorMessage, apiFieldErrors } from "@/lib/api-error.ts"

const MIN = 4
const MAX = 6

/** Enter a new PIN, then repeat it: a typo here would lock someone out at the next shift. */
export function PinSheet({
  member,
  onClose,
}: {
  member: Staff | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const setPin = useSetPin()
  const [first, setFirst] = useState<string | null>(null)
  const [pin, setPinValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const reset = () => {
    setFirst(null)
    setPinValue("")
    setError(null)
  }

  const next = async () => {
    if (!member || pin.length < MIN) return
    if (first === null) {
      setFirst(pin)
      setPinValue("")
      return
    }
    if (pin !== first) {
      setError(t("staff.pinMismatch"))
      setAttempt((n) => n + 1)
      setFirst(null)
      setPinValue("")
      return
    }
    try {
      await setPin.mutateAsync({ id: member.id, pin })
      toast.success(t("staff.pinSaved", { name: member.full_name }))
      reset()
      onClose()
    } catch (err) {
      setError(apiFieldErrors(err).pin ?? apiErrorMessage(err))
      setAttempt((n) => n + 1)
      reset()
    }
  }

  return (
    <TouchSheet
      open={member !== null}
      onOpenChange={(open) => {
        if (!open) {
          reset()
          onClose()
        }
      }}
      side="right"
      title={member ? t("staff.pinTitle", { name: member.full_name }) : ""}
      description={first === null ? t("staff.pinNew") : t("staff.pinConfirm")}
      footer={
        <Button
          size="xl"
          className="w-full"
          disabled={pin.length < MIN || setPin.isPending}
          onClick={() => void next()}
        >
          {setPin.isPending && <Spinner />}
          {first === null ? t("staff.pinConfirm") : t("common.save")}
        </Button>
      }
    >
      <div className="mx-auto flex max-w-xs flex-col items-center pt-4">
        <PinDots
          length={Math.max(MIN, pin.length)}
          filled={pin.length}
          error={Boolean(error)}
          attempt={attempt}
        />
        <p
          role="alert"
          className="mt-3 min-h-10 text-center text-sm text-danger-ink"
        >
          {error}
        </p>
        <NumPad
          className="w-full"
          keyboard={member !== null}
          deleteLabel={t("auth.deleteDigit")}
          onDigit={(digit) => {
            setError(null)
            setPinValue((value) =>
              value.length >= MAX ? value : value + digit
            )
          }}
          onBackspace={() => setPinValue((value) => value.slice(0, -1))}
          bottomLeft={{
            label: t("auth.clearPin"),
            content: t("auth.clearPin"),
            onPress: () => setPinValue(""),
          }}
        />
      </div>
    </TouchSheet>
  )
}
