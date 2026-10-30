/**
 * Output sizes for uploaded images. Keep in step with the ImageSpec values in
 * backend/common/images.py, which re-checks and re-encodes every upload.
 */
export type ImagePreset = {
  width: number
  height: number
  /** How the crop window and preview are drawn. */
  shape: "round" | "rect"
}

export const imagePresets = {
  /** Menu and product photos: the 4:3 of the order screen's cards. */
  product: { width: 1200, height: 900, shape: "rect" },
  /** Promo banners on the checkout picker: wide, like a ticket. */
  promo: { width: 1200, height: 600, shape: "rect" },
} as const satisfies Record<string, ImagePreset>

export type ImagePresetName = keyof typeof imagePresets

/** Largest file the picker accepts before cropping. The server allows the same. */
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const
