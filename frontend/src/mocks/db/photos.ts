import manifest from "@/mocks/db/photos.json"

export type MockPhoto = {
  key: string
  group: "food" | "snack"
  subject: string
  /** 800px wide, for cards and sheets. */
  src: string
  /** 400px wide, for small tiles. */
  srcSmall: string
}

/** Stock photos for the mock menu and snack bar. Files and sources: public/mock/ and public/mock/CREDITS.md. */
export const mockPhotos: MockPhoto[] = (
  manifest as {
    key: string
    group: "food" | "snack"
    subject: string
    ext: string
  }[]
).map(({ ext, ...photo }) => ({
  ...photo,
  src: `/mock/${photo.group}/${photo.key}.${ext}`,
  srcSmall: `/mock/${photo.group}/${photo.key}-400.${ext}`,
}))

export function photoFor(key: string) {
  return mockPhotos.find((photo) => photo.key === key)
}
