---
name: mangaka-ui
description: Build or restyle any screen or component in Mangaka AI in the Studio style. Use for layout, colour, spacing, typography, motion and visual polish, and before calling a UI change finished.
---

# Studio style for Mangaka AI

`docs/12-phong-cach-studio.md` shows the style and why it looks this way. `docs/05-design-system.md` is the source of truth for tokens and components. This skill is how to apply them. For icons, also use the `mangaka-icons` skill.

## Direction

A small print studio: warm ink or cream paper surfaces, floating panels, coral as the working accent, and hand-printed riso art for the screens that carry feeling. While drawing, the user's page stays the brightest thing on screen.

Art must never look AI-generated. No neon, glow, gloss, hyper detail or purple and magenta. Each image is black plus one ink on cream paper, with grain and uneven lines. Reject and redo anything that looks generated. Art lives in `src/assets/art` and `src/ui/art.ts`, and text over it uses the `onPaper` tone.

## Rules that decide most choices

1. **The page leads.** Never place tools over the page when a row can hold them. If a panel must overlap, keep the selected object visible, as `useCardLift` does for the bubble card.
2. **Colour comes from ink.** `accent` is for the primary action and the selected state. `ai` is only for AI. Extra colour comes from the printed art, not from new interface tokens.
3. **Depth comes from lightness.** `bg`, `surface`, `raised`, `overlay` go from low to high. Use a border only when two surfaces can't be told apart.
4. **Selected is more than a colour.** Pair the colour with a filled icon or a filled background.
5. **Style through tokens.** Use `className` with literal class strings, because Uniwind reads them statically. No raw hex, font size or radius in a screen.
6. **Empty is designed.** Use `EmptyState` with an icon and a next step. A story with no image uses the typeset `Cover`, not a blank box.
7. **Keep touch targets at 48dp** and keep text at 12dp or above. Respect reduced motion.

## Reuse before you build

Start from `src/ui`: `Screen`, `AppBar`, `ArtBanner`, `Card`, `Button`, `IconButton`, `Chip`, `ModeSwitch`, `Sheet`, `Dialog`, `Menu`, `EmptyState`, `Cover`, `Banner`. A new look belongs in the component, so every screen gets it. A required image carries its pixel size as style, so give it an explicit width and height or it overflows its box.

## Keyboard

A field with `autoFocus` inside `Sheet` or `Dialog` works through `ModalShownContext`. A screen opened from a closing `Menu` may keep focus without showing the keyboard. This is a known open issue.

## Check it on a device

Tests do not see layout. Before calling UI work finished:

1. Run a debug build. Release sets `FLAG_SECURE`, so its screenshots are black.
2. Capture the real screen with `adb exec-out screencap -p`.
3. Check both themes, a 360dp width, and the keyboard open. Use a real phone with three-button navigation when you can: text truncation and system bar bugs do not show on the emulator.
4. Cold start before trusting what you see. Fast Refresh can return to Home and can drop bubble text until the next launch.
5. Run `npx tsc --noEmit`, `npx jest` and `npx eslint src __tests__ --ext .ts,.tsx`. A colour change must pass `__tests__/theme.contrast.test.ts`.
