import { CameraOffIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { TouchSheet } from "@/components/pos/touch-sheet.tsx"

/** The Shape Detection API: Chrome on Android has it, iPad Safari does not. */
type Detector = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>
}
type DetectorClass = new (options: { formats: string[] }) => Detector

const BarcodeDetector = (
  globalThis as unknown as { BarcodeDetector?: DetectorClass }
).BarcodeDetector

export const cameraScanSupported =
  BarcodeDetector !== undefined &&
  typeof navigator !== "undefined" &&
  Boolean(navigator.mediaDevices?.getUserMedia)

function Viewfinder({ onScan }: { onScan: (code: string) => void }) {
  const { t } = useTranslation()
  const video = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(false)
  const done = useRef(onScan)
  useEffect(() => {
    done.current = onScan
  })

  useEffect(() => {
    if (!BarcodeDetector) return
    const detector = new BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
    })
    let stream: MediaStream | null = null
    let timer = 0
    let stopped = false

    const tick = async () => {
      const element = video.current
      if (stopped || !element) return
      try {
        const [found] = await detector.detect(element)
        if (found?.rawValue) {
          done.current(found.rawValue)
          return
        }
      } catch {
        // A frame that isn't ready yet; try the next one.
      }
      timer = window.setTimeout(() => void tick(), 200)
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async (media) => {
        if (stopped) return media.getTracks().forEach((track) => track.stop())
        stream = media
        if (video.current) {
          video.current.srcObject = media
          await video.current.play()
          void tick()
        }
      })
      .catch(() => setFailed(true))

    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  if (failed)
    return (
      <div className="grid aspect-video place-items-center rounded-2xl bg-muted text-center text-sm text-muted-foreground">
        <div className="space-y-2">
          <CameraOffIcon className="mx-auto size-8" />
          <p>{t("snackbar.cameraDenied")}</p>
        </div>
      </div>
    )

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <video
        ref={video}
        muted
        playsInline
        className="aspect-video w-full object-cover"
      />
      {/* The aiming box: barcodes read best held level inside it. */}
      <div className="pointer-events-none absolute inset-x-10 top-1/2 h-24 -translate-y-1/2 rounded-xl border-2 border-white/80 shadow-[0_0_0_999px_rgb(0_0_0/0.35)]" />
    </div>
  )
}

/** Scanning with the tablet's camera, for counters without a scanner gun. */
export function CameraScanSheet({
  open,
  onClose,
  onScan,
}: {
  open: boolean
  onClose: () => void
  onScan: (code: string) => void
}) {
  const { t } = useTranslation()
  return (
    <TouchSheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t("snackbar.camera")}
      description={t("snackbar.cameraBody")}
    >
      {open && (
        <div className="pb-4">
          <Viewfinder
            onScan={(code) => {
              onScan(code)
              onClose()
            }}
          />
        </div>
      )}
    </TouchSheet>
  )
}
