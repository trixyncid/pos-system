import type { ImagePreset } from "@/lib/image-presets.ts"

export type PixelArea = { x: number; y: number; width: number; height: number }

const WEBP_QUALITY = 0.86
const JPEG_QUALITY = 0.9

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = "async"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("This image could not be read."))
    image.src = src
  })
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, quality)
  )
}

/**
 * Draw the chosen area into a canvas at the preset size and encode it as WebP.
 * Small sources are not enlarged. Browsers that cannot encode WebP (older Safari)
 * fall back to JPEG; the server converts every upload to WebP either way.
 */
export async function cropImage(
  src: string,
  area: PixelArea,
  rotation: number,
  preset: ImagePreset,
  name: string
) {
  const image = await loadImage(src)
  const radians = (rotation * Math.PI) / 180
  const sin = Math.abs(Math.sin(radians))
  const cos = Math.abs(Math.cos(radians))
  const rotatedWidth = image.naturalWidth * cos + image.naturalHeight * sin
  const rotatedHeight = image.naturalWidth * sin + image.naturalHeight * cos

  // Rotate the whole image first so the crop area (in rotated coordinates) maps one to one.
  const stage = document.createElement("canvas")
  stage.width = Math.round(rotatedWidth)
  stage.height = Math.round(rotatedHeight)
  const stageContext = stage.getContext("2d")
  if (!stageContext) throw new Error("This browser cannot crop images.")
  stageContext.translate(stage.width / 2, stage.height / 2)
  stageContext.rotate(radians)
  stageContext.drawImage(
    image,
    -image.naturalWidth / 2,
    -image.naturalHeight / 2
  )

  const scale = Math.min(
    1,
    preset.width / area.width,
    preset.height / area.height
  )
  const output = document.createElement("canvas")
  output.width = Math.max(1, Math.round(area.width * scale))
  output.height = Math.max(1, Math.round(area.height * scale))
  const context = output.getContext("2d")
  if (!context) throw new Error("This browser cannot crop images.")
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  context.drawImage(
    stage,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    output.width,
    output.height
  )

  const base = name.replace(/\.[^.]+$/, "") || "image"
  const webp = await toBlob(output, "image/webp", WEBP_QUALITY)
  if (webp && webp.type === "image/webp")
    return new File([webp], `${base}.webp`, { type: "image/webp" })
  const jpeg = await toBlob(output, "image/jpeg", JPEG_QUALITY)
  if (!jpeg) throw new Error("The cropped image could not be saved.")
  return new File([jpeg], `${base}.jpg`, { type: "image/jpeg" })
}
