# ColorPalette

The ten saved RGBA8 colors of a [Pixel Document](./PixelDocument.md). Slots
have fixed indices from `0` to `9`. Changing a palette slot changes future
brush use; existing texture pixels retain their colors.

```ts
import {
  ColorPalette,
  COLOR_PALETTE_SIZE
} from "@jolly-pixel/pixel-draw.renderer";

const palette = ColorPalette.create();
const changed = palette.withColor(3, { r: 12, g: 34, b: 56, a: 128 });
doc.changePaletteColor(3, changed.colorAt(3));
```

| Member | Contract |
|---|---|
| `COLOR_PALETTE_SIZE` | `10` |
| `ColorPalette.create()` | Creates the default palette |
| `ColorPalette.from(colors)` | Copies exactly ten RGBA8 colors; throws `TypeError` for invalid data |
| `ColorPalette.parse(value)` | Parses unknown data, returning `null` when invalid |
| `colorAt(index)` | Returns an independent copy of a slot's color |
| `withColor(index, color)` | Returns a new palette, or the same instance when unchanged |
| `toJSON()` | Returns independent copies of all ten colors in slot order |

Every channel is an integer from `0` to `255`, including alpha. Invalid
indices throw `RangeError`; invalid replacement colors throw `TypeError`.
Input arrays and colors cannot mutate the palette after construction.

The defaults, in slot order, are `#000000`, `#ffffff`, `#808080`, `#e63946`,
`#ff8c00`, `#ffdd00`, `#40b450`, `#00b4b4`, `#4070e0`, and `#a050c8`, all
opaque. New documents use these defaults. Loading a document or snapshot
without a palette restores the same defaults.

`doc.palette` is read-only. `doc.changePaletteColor(index, color)` commits
one slot change through document history and emits a
[`palette-color-changed` command](./PixelCommand.md). It ignores unchanged
colors. Selection and picker drafts belong to the view; the document stores
only the ten committed colors.
