import { CheckIcon, ChevronDownIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { useTheme } from "@/components/theme-provider.tsx"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx"
import { Switch } from "@/components/ui/switch.tsx"
import { setLanguage, type Language } from "@/lib/i18n.ts"
import { cn } from "@/lib/utils.ts"

/**
 * Flags as inline SVG: emoji flags don't render on every tablet (Windows
 * and some Android skins show two letters instead).
 */
function FlagID({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" className={className} aria-hidden>
      <rect width="24" height="8" fill="#ce1126" />
      <rect y="8" width="24" height="8" fill="#ffffff" />
    </svg>
  )
}

function FlagGB({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 40" className={className} aria-hidden>
      <clipPath id="flag-gb-clip">
        <rect width="60" height="40" />
      </clipPath>
      <g clipPath="url(#flag-gb-clip)">
        <rect width="60" height="40" fill="#012169" />
        <path d="M0,0 60,40 M60,0 0,40" stroke="#fff" strokeWidth="8" />
        <path d="M0,0 60,40 M60,0 0,40" stroke="#c8102e" strokeWidth="3" />
        <path d="M30,0 V40 M0,20 H60" stroke="#fff" strokeWidth="12" />
        <path d="M30,0 V40 M0,20 H60" stroke="#c8102e" strokeWidth="7" />
      </g>
    </svg>
  )
}

const LANGUAGES: {
  code: Language
  label: string
  short: string
  Flag: typeof FlagID
}[] = [
  { code: "id", label: "Bahasa Indonesia", short: "ID", Flag: FlagID },
  { code: "en", label: "English", short: "EN", Flag: FlagGB },
]

const flagClass =
  "h-4 w-6 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/10"

/** The language picker: a flag and code in the bar, both languages in full in the menu. */
export function LanguageMenu({ className }: { className?: string }) {
  const { t, i18n } = useTranslation()
  const current =
    LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0]!
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("common.language")}
        className={cn(
          "flex h-11 items-center gap-2 rounded-xl px-2.5 text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted",
          className
        )}
      >
        <current.Flag className={flagClass} />
        {current.short}
        <ChevronDownIcon className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {LANGUAGES.map(({ code, label, Flag }) => (
          <DropdownMenuItem
            key={code}
            className="h-11"
            onSelect={() => setLanguage(code)}
          >
            <Flag className={flagClass} />
            <span className="flex-1">{label}</span>
            {code === current.code && <CheckIcon className="text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Light or dark, as one switch with a sun and a moon on either side. */
export function ThemeSwitch({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  return (
    <label
      className={cn(
        "flex h-11 cursor-pointer items-center gap-2 rounded-xl px-2.5 text-muted-foreground",
        className
      )}
    >
      <SunIcon
        className={cn("size-4 transition-colors", !dark && "text-warning-ink")}
        aria-hidden
      />
      <Switch
        size="lg"
        checked={dark}
        onCheckedChange={(on) => setTheme(on ? "dark" : "light")}
        aria-label={t("common.darkMode")}
      />
      <MoonIcon
        className={cn("size-4 transition-colors", dark && "text-foreground")}
        aria-hidden
      />
    </label>
  )
}
