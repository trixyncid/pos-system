# Design

The direction is set in [plan.md](plan.md#visual-and-motion-design-docsdesignmd). This page records what M1 built and how to use it.

## Principles

- **Tablets, landscape first:** 1180×820 (iPad) and 1280×800 (Android). Portrait must still work.
- **Touch:** targets are at least 48px, primary actions 56–64px. Nothing is reachable only by hovering. Primary actions sit on the right, near the thumb.
- **Colour:** warm neutrals with one terracotta accent. Light by default, dark mode for evening service. Colour is never the only signal: status always carries text too.
- **Type:** Inter Variable for text, Lexend Deca Variable (`font-heading`) for headings and numbers. Prices and clocks use `tabular-nums`.
- **Motion:** short and interruptible. Staff tap hundreds of times a shift, so no one should ever wait on an animation. `MotionConfig reducedMotion="user"` and the `prefers-reduced-motion` CSS guard are both always on.

## Tokens (`frontend/src/index.css`)

| Token | Use |
|---|---|
| `--primary` | Terracotta accent: the main action, active states, focus ring |
| `--canvas` | App background behind cards |
| `--success` / `--warning` / `--danger`, each with an `-ink` shade | Status fills, and the readable text colour on top of them |
| `--shadow-soft` / `--shadow-raised` / `--shadow-overlay` | Elevation: cards / lifted cards / sheets and dialogs. Use them as `shadow-(--shadow-soft)` |
| `--radius` 0.875rem | Base radius. Cards and keys use `rounded-2xl`, sheets `rounded-3xl` |
| `animate-shake`, `animate-flash` | A wrong PIN or an unknown barcode / a row that just changed |
| `pt-safe`, `pb-safe` | Insets for the iPad home indicator and notch |

## Motion (`frontend/src/lib/motion.ts`)

| Spring | Use |
|---|---|
| `spring.press` | Press-in on cards and keys (through `Pressable`) |
| `spring.layout` | Lists entering, leaving and reordering; the sliding nav indicators (`layoutId`) |
| `spring.sheet` | Panels and sheets |
| `spring.pop` | Badges, PIN dots, quantity digits |

CSS entrances (`rise-in`, `pop-in`, `sheet-up`) are for things that appear once. `motion` is for anything interactive.

## Components

| Component | Path | Notes |
|---|---|---|
| `Button` sizes `touch`, `xl`, `icon-touch` | `components/ui/button.tsx` | 48 / 56 / 48px. Use `xl` for the screen's main action |
| `Pressable` | `components/motion/pressable.tsx` | Tap target with spring press-in, for cards, tiles and keys |
| `CountUp`, `RiseIn`, `PopIn` | `components/motion/` | `CountUp` rolls a number; screen readers get the final value |
| `NumPad` | `components/pos/num-pad.tsx` | 3×4 keypad with 64px keys. Set `keyboard` to also accept a physical keypad |
| `QtyStepper` | `components/pos/qty-stepper.tsx` | The digit rolls up or down on change |
| `MoneyText` | `components/pos/money-text.tsx` | "Rp 25.000", tabular. `animate` rolls the value |
| `StatusPill` | `components/pos/status-pill.tsx` | Dot plus label. `pulse` for live states |
| `ProductImage` | `components/pos/product-image.tsx` | Fades in from a blurred placeholder. Falls back to a lettered tile |
| `StaffAvatar` | `components/pos/staff-avatar.tsx` | Initials, with a stable colour per name |
| `TouchSheet` | `components/pos/touch-sheet.tsx` | A draggable sheet (vaul), `bottom` or `right` |

## Shells

- **POS shell** (`features/shell/components/pos-shell.tsx`): a 64px top bar with the outlet name, a segmented nav (sliding indicator), the clock, a back-office link and the user menu. The rest of the screen belongs to the page.
- **Back-office shell** (`backoffice-shell.tsx`): a sidebar grouped by section. It is 256px wide in landscape and shrinks to 80px icons under the `lg` breakpoint.
- Both show only the pages in `page-catalog.ts` that the user's permissions open.

## Shared tablet flow

1. A manager signs the tablet in (`/login`).
2. Staff unlock it from the lock screen: pick your name, enter your PIN. A 4-digit PIN submits by itself; a 5–6 digit PIN submits after a short pause.
3. The tablet locks after 3 minutes idle, from **Kunci** in the user menu, and after every reload. The screen underneath keeps its state.
4. After unlocking, the user stays on the current screen if their roles open it. Otherwise they go to their own start screen.
