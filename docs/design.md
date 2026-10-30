# Design

This document is filled in during M1 (design system). The direction is fixed in [plan.md](plan.md#visual-and-motion-design-docsdesignmd).

## Principles

- **Tablets, landscape first:** 1180×820 (iPad) and 1280×800 (Android). Portrait must still work.
- **Touch:** targets are at least 48px, primary actions 56–64px. No action is reachable only on hover. The cart and its primary action sit on the right edge, near the thumb.
- **Colour:** warm neutrals with one terracotta accent (`--primary`). Light by default, dark mode for evening service. Tokens are in `frontend/src/index.css`.
- **Type:** Inter Variable for text, Lexend Deca Variable for headings and numbers. Prices use tabular figures.
- **Motion:** `motion` handles layout and shared-element transitions, springs and gestures. CSS keyframes (`rise-in`, `pop-in`, `sheet-up`) handle simple entrances. `MotionConfig reducedMotion="user"` and the `prefers-reduced-motion` CSS guard are both always on.
- **Photos:** food photos are the hero of the order screen. Mockups use local, resized Unsplash or Pexels photos, credited in `frontend/public/mock/CREDITS.md`.

## To define in M1

- Token scale: spacing, radius, elevation, motion durations and springs.
- POS primitives: NumPad, BigButton, QtyStepper, MoneyText, StatusPill, ProductImage, TouchSheet.
- POS and back-office shells, the PIN lock screen.
