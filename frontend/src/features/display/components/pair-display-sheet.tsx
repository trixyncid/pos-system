import { MonitorIcon, UnplugIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { TouchSheet } from "@/components/pos/touch-sheet.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Field, FieldError, FieldLabel } from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import {
  pushDisplayState,
  usePairDisplay,
  usePairedDisplay,
} from "@/features/display/api/display.ts"
import { IDLE } from "@/features/display/lib/state.ts"
import { apiErrorMessage, apiFieldErrors } from "@/lib/api-error.ts"

/**
 * Connect this cashier screen to a customer display by the six-digit code
 * the display shows. The link belongs to this device, not the staff member.
 */
export function PairDisplaySheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const paired = usePairedDisplay((state) => state.paired)
  const setPaired = usePairedDisplay((state) => state.set)
  const pair = usePairDisplay()
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError(t("display.codeInvalid"))
      return
    }
    setError(null)
    try {
      await pair.mutateAsync(code)
      toast.success(t("display.paired"))
      setCode("")
      onClose()
    } catch (err) {
      setError(apiFieldErrors(err).code ?? apiErrorMessage(err))
    }
  }

  const disconnect = () => {
    if (paired) void pushDisplayState(paired.id, IDLE)
    setPaired(null)
    toast.success(t("display.unpaired"))
  }

  return (
    <TouchSheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      side="center"
      title={t("display.sheetTitle")}
      description={paired ? undefined : t("display.sheetBody")}
      className="w-[min(28rem,calc(100vw-2rem))]"
    >
      {paired ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl bg-success/10 p-4">
            <MonitorIcon className="mt-0.5 size-5 shrink-0 text-success-ink" />
            <div>
              <p className="font-medium text-success-ink">
                {t("display.connected", { name: paired.name })}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("display.connectedBody")}
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="touch"
            className="w-full"
            onClick={disconnect}
          >
            <UnplugIcon />
            {t("display.disconnect")}
          </Button>
        </div>
      ) : (
        <form
          className="space-y-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <Field data-invalid={error !== null}>
            <FieldLabel htmlFor="display-code">{t("display.code")}</FieldLabel>
            <Input
              id="display-code"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              aria-invalid={error !== null}
              className="h-16 rounded-2xl text-center font-heading text-4xl tracking-[0.4em] tabular-nums"
            />
            <FieldError errors={error ? [{ message: error }] : []} />
          </Field>
          <Button
            type="submit"
            size="xl"
            className="w-full"
            disabled={pair.isPending}
          >
            {pair.isPending ? <Spinner /> : <MonitorIcon />}
            {t("display.connect")}
          </Button>
        </form>
      )}
    </TouchSheet>
  )
}
