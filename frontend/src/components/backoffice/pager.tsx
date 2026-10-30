import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button.tsx"

/** Previous/next for paginated lists; hidden when everything fits on one page. */
export function Pager({
  page,
  hasPrevious,
  hasNext,
  onPage,
}: {
  page: number
  hasPrevious: boolean
  hasNext: boolean
  onPage: (page: number) => void
}) {
  const { t } = useTranslation()
  if (!hasPrevious && !hasNext) return null
  return (
    <div className="flex items-center justify-center gap-3">
      <Button
        variant="secondary"
        size="icon-touch"
        aria-label={t("common.previous")}
        disabled={!hasPrevious}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeftIcon />
      </Button>
      <span className="text-sm text-muted-foreground tabular-nums">{page}</span>
      <Button
        variant="secondary"
        size="icon-touch"
        aria-label={t("common.next")}
        disabled={!hasNext}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRightIcon />
      </Button>
    </div>
  )
}
