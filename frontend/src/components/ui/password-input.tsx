import { EyeIcon, EyeOffIcon } from "lucide-react"
import { useState, type ComponentProps } from "react"
import { useTranslation } from "react-i18next"

import { Input } from "@/components/ui/input.tsx"
import { cn } from "@/lib/utils.ts"

/** A password (or PIN) input with a show/hide eye, sized for a thumb. */
export function PasswordInput({
  className,
  wrapperClassName,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { wrapperClassName?: string }) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  return (
    <div className={cn("relative", wrapperClassName)}>
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-12", className)}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
        onClick={() => setVisible((current) => !current)}
        aria-label={
          visible ? t("common.hidePassword") : t("common.showPassword")
        }
        aria-pressed={visible}
      >
        {visible ? (
          <EyeOffIcon className="size-5" />
        ) : (
          <EyeIcon className="size-5" />
        )}
      </button>
    </div>
  )
}
