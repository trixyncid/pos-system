import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import { en } from "@/locales/en.ts"
import { id } from "@/locales/id.ts"

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> }
/** The shape every language must fill, taken from the Indonesian source. */
export type Messages = Widen<typeof id>

export const languages = ["id", "en"] as const
export type Language = (typeof languages)[number]

const storageKey = "pos.language"

function storedLanguage(): Language {
  try {
    const value = window.localStorage.getItem(storageKey)
    return value === "en" ? "en" : "id"
  } catch {
    return "id"
  }
}

void i18n.use(initReactI18next).init({
  resources: { id: { translation: id }, en: { translation: en } },
  lng: storedLanguage(),
  fallbackLng: "id",
  interpolation: { escapeValue: false },
  returnNull: false,
})

export function setLanguage(language: Language) {
  try {
    window.localStorage.setItem(storageKey, language)
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  void i18n.changeLanguage(language)
  document.documentElement.lang = language
}

declare module "i18next" {
  interface CustomTypeOptions {
    resources: { translation: typeof id }
  }
}

export default i18n
