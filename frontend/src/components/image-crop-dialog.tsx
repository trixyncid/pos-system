import { RotateCwIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react"
import { useState } from "react"
import Cropper, { type Area, type Point } from "react-easy-crop"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx"
import { Spinner } from "@/components/ui/spinner.tsx"
import { cropImage } from "@/lib/crop-image.ts"
import type { ImagePreset } from "@/lib/image-presets.ts"

const MIN_ZOOM = 1
const MAX_ZOOM = 4

/**
 * Crop a photo to a preset's exact shape before upload (from the membership
 * app). The window is locked to the preset ratio: drag to move, pinch or
 * use the slider to zoom, rotate a sideways phone photo.
 */
export function ImageCropDialog({
  source,
  fileName,
  preset,
  title,
  onCancel,
  onCropped,
}: {
  /** Object URL of the picked file, or null when the dialog is closed. */
  source: string | null
  fileName: string
  preset: ImagePreset
  title: string
  onCancel: () => void
  onCropped: (file: File) => void
}) {
  const { t } = useTranslation()
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [area, setArea] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  const ratio = preset.width / preset.height

  async function apply() {
    if (!source || !area) return
    setSaving(true)
    setError(undefined)
    try {
      onCropped(await cropImage(source, area, rotation, preset, fileName))
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : t("crop.failed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={source !== null}
      onOpenChange={(open) => {
        if (!open && !saving) onCancel()
      }}
    >
      <DialogContent className="gap-5 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {t("crop.body", { width: preset.width, height: preset.height })}
          </DialogDescription>
        </DialogHeader>

        <div
          className="relative w-full overflow-hidden rounded-2xl bg-black"
          style={{
            aspectRatio: ratio >= 1.5 ? "16 / 10" : "4 / 3",
            maxHeight: "60svh",
          }}
        >
          {source ? (
            <Cropper
              image={source}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={ratio}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              cropShape={preset.shape === "round" ? "round" : "rect"}
              showGrid={preset.shape !== "round"}
              objectFit="contain"
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
            />
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-touch"
            aria-label={t("crop.zoomOut")}
            onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - 0.25))}
          >
            <ZoomOutIcon />
          </Button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            aria-label={t("crop.zoom")}
            className="h-2 flex-1 cursor-pointer accent-primary"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-touch"
            aria-label={t("crop.zoomIn")}
            onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + 0.25))}
          >
            <ZoomInIcon />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="touch"
            onClick={() => setRotation((value) => (value + 90) % 360)}
          >
            <RotateCwIcon />
            {t("crop.rotate")}
          </Button>
        </div>

        {error ? <p className="text-sm text-danger-ink">{error}</p> : null}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            size="touch"
            disabled={saving}
            onClick={onCancel}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            size="touch"
            disabled={saving || !area}
            onClick={() => void apply()}
          >
            {saving && <Spinner />}
            {t("crop.use")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
