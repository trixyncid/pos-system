"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

import "sonner/dist/styles.css"
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react"

/**
 * Toasts are solid green, red, amber or blue with white text, in dark mode
 * too, so they stand out from the UI. Top centre, where a tablet user is
 * looking.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          // Solid fills with white text, the same in light and dark mode.
          // Deep shades so white text stays readable (WCAG AA).
          "--success-bg": "#15803d",
          "--success-border": "#15803d",
          "--success-text": "#ffffff",
          "--error-bg": "#b91c1c",
          "--error-border": "#b91c1c",
          "--error-text": "#ffffff",
          "--warning-bg": "#b45309",
          "--warning-border": "#b45309",
          "--warning-text": "#ffffff",
          "--info-bg": "#1d4ed8",
          "--info-border": "#1d4ed8",
          "--info-text": "#ffffff",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
      theme="light"
      richColors
      closeButton
      position="top-center"
    />
  )
}

export { Toaster }
