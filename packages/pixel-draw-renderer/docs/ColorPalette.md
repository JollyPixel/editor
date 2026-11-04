# ColorPalette

The saved RGBA8 colors of a [Pixel Document](./PixelDocument.md): 1 to 256
slots, indexed from `0`. Changing a palette slot changes future brush use;
existing texture pixels keep their colors.

```ts
import {
  ColorPalette,
  COLOR_PALETTE_MAX_SIZE
} from "@jolly-pixel/pixel-draw.renderer";

const palette = doc.palette.withInserted(doc.palette.size, [
  { r: 12, g: 34, b: 56, a: 128 }
]);
doc.replacePalette(palette);
```

## API

```ts
const COLOR_PALETTE_MAX_SIZE = 256;

class ColorPalette {
  static create(): ColorPalette;
  static from(colors: readonly RGBA8[]): ColorPalette;
  static parse(value: unknown): ColorPalette | null;

  readonly size: number;

  colorAt(index: number): RGBA8;
  withColor(index: number, color: RGBA8): ColorPalette;
  withColors(start: number, colors: readonly RGBA8[]): ColorPalette;
  withInserted(index: number, colors: readonly RGBA8[]): ColorPalette;
  withRemoved(start: number, count?: number): ColorPalette;
  withMoved(start: number, count: number, to: number): ColorPalette;
  equals(other: ColorPalette): boolean;
  toJSON(): RGBA8[];
}
```

- `create` returns the default palette. `from` copies 1 to 256 colors and
  throws a `TypeError` for anything else; `parse` returns `null` instead.
- Every `with*` method returns a new palette, or the same instance when
  nothing changes.
- `withColors` replaces the run of slots starting at `start`, which must fit
  inside the palette.
- `withInserted` inserts before `index`, from `0` to `size`. It throws a
  `RangeError` past 256 colors.
- `withRemoved` removes `count` slots, `1` by default. It throws a
  `RangeError` when that would leave no color.
- `withMoved` moves a run so that it starts at `to` in the result.
- Out of range indices throw `RangeError`; colors whose channels are not
  integer bytes throw `TypeError`. Inputs and returned colors are copies.

The defaults, in slot order, are `#000000`, `#ffffff`, `#808080`, `#e63946`,
`#ff8c00`, `#ffdd00`, `#40b450`, `#00b4b4`, `#4070e0`, and `#a050c8`, all
opaque. New documents use them, and so does loading a document or snapshot
without a palette.

`doc.palette` is read-only. `doc.changePaletteColor(index, color)` commits
one slot through document history as a
[`palette-color-changed` command](./PixelCommand.md).
`doc.replacePalette(palette)` commits a resize, reorder or any larger edit as
one `palette-replaced` command. Both ignore unchanged palettes. Selection and
picker drafts belong to the view.

## `visibleColors()`

```ts
function visibleColors(pixels: ArrayLike<number>, limit: number): RGBA8[];
```

Reads RGBA8 bytes, such as `doc.buffer.pixels()`, and returns each color
whose alpha is not `0` once, in first-seen order. It stops after `limit`
colors: pass `COLOR_PALETTE_MAX_SIZE + 1` to learn whether a texture holds
more colors than a palette can.

```ts
const colors = visibleColors(doc.buffer.pixels(), COLOR_PALETTE_MAX_SIZE);
if (colors.length > 0) {
  doc.replacePalette(ColorPalette.from(colors));
}
```
