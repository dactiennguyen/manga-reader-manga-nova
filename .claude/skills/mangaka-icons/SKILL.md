---
name: mangaka-icons
description: Pick, add or change an icon in Mangaka AI. Use for any new icon, any IconButton, tool, tab or status glyph, and whenever a screen needs an icon.
---

# Icons in Mangaka AI

One family: Phosphor (`phosphor-react-native`). Do not add a second icon library, and never use emoji as an icon.

## Where icons live

Every icon is named in `src/ui/icons.ts`, for what it means and not for how it looks: `UndoIcon`, `MoreIcon`, `PreviewIcon`.

```ts
import { UndoIcon } from '../../ui/icons';
```

To add one:

1. Reuse an existing name if the meaning is the same.
2. Check the glyph exists: `ls node_modules/phosphor-react-native/src/icons | grep -i <word>`.
3. Add one line to `src/ui/icons.ts`, in alphabetical order:
   `export { PenNibIcon as GPenIcon } from 'phosphor-react-native/src/icons/PenNib';`

Always import from `src/icons/<Name>`. The package index pulls all 1,512 icons into the bundle. `__tests__/iconRegistry.test.ts` fails if a file skips the registry.

## Weight says state

| Weight | Use |
| --- | --- |
| `regular` | The default for every icon |
| `fill` | The selected item: Dock tab, ModeSwitch, Chip, active IconButton, active tool. Also the AI mark |
| `duotone` | Large illustrative icons, such as `EmptyState` |
| `bold` | Only an icon on a solid accent button, such as the Dock create button |

The shared components already switch weight. Pass `selected` or `active` and do not set `weight` by hand. Items at the same level use the same weight, so a selected item is the only one that differs. State never rests on colour alone.

Do not use `thin` or `light`: their strokes look weak next to Inter at 16 to 24dp, and the set stops feeling like one family.

## Size

Use `ICON` from `src/ui/tokens.ts`: `xs` 14, `sm` 16, `md` 20, `lg` 24, `xl` 32, `xxl` 40. Never write a raw number.

## Accessibility

- An icon beside visible text is decorative and adds no label.
- An icon alone needs `accessibilityLabel`. `IconButton` requires it.
- Touch target is 48dp, whatever the glyph size.
- In a right-to-left manga, name arrows by reading direction, not by the glyph: the left caret is "Next page".

## Colour

Use colour tokens through `Icon color="..."`. Text-level tokens all pass 3:1 on every surface. `ai` is only for AI. Never put a white icon on `accent` in dark theme: use `on-accent`.
