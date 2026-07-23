# Brush

Manages primary/secondary colors, brush size, and highlight colors. Computes texture-space pixels covered per stroke. Left-click → `primary`; right-click → `secondary`.

> Reached via `PixelArtCanvas.brush`. For color-picking (`pickArmed` / `pick`), see [BrushTool.md](./BrushTool.md).

## Types

```ts
new Brush(options: BrushOptions)

export type ColorInput = string | Color; // Color is colorjs.io's Color class
export type BrushColorSlot = "primary" | "secondary";

export interface BrushOptions {
  /**
   * Base primary color of the brush. Accepts a CSS color string (hex, rgb(), hsl(),
   * named color, ...) or a colorjs.io `Color` instance.
   * Opacity can be controlled separately with `primary.opacity`.
   * @default "#000000"
   */
  color?: ColorInput;
  /**
   * Base secondary color of the brush, applied by a right-click stroke.
   * @default "#FFFFFF"
   */
  secondaryColor?: ColorInput;
  /**
   * Size of the brush in pixels. Must be a positive integer.
   * The actual affected area will be a square of `size x size` pixels centered around the target pixel.
   * @default 32
   */
  size?: number;
  /**
   * Maximum allowed size for the brush. This is used to constrain the `size` property.
   * Must be a positive integer. If `size` is set higher than `maxSize`, it will be clamped to `maxSize`.
   * @default 32
   */
  maxSize?: number;
  /**
   * Highlight colors for the brush preview.
   * These colors are used to render the brush outline and fill when hovering over the canvas.
   * @default { colorInline: "#FFF", colorOutline: "#000" }
   */
  highlight?: {
    colorInline?: ColorInput;
    colorOutline?: ColorInput;
  };
}
```

## `primary` / `secondary`

```ts
readonly primary: BrushColor
readonly secondary: BrushColor
```

Color+opacity pair. API:

```ts
set(color: ColorInput, opacity?: number): void
asString(format?: "rgba" | "hex"): string
get/set opacity: number
```

- `set(color, opacity?)`: sets the color from a CSS color string or a colorjs.io `Color` instance. If `opacity` is omitted, the current opacity is preserved; otherwise it's clamped to `[0, 1]` and applied alongside the new color.
- `set`: color from CSS string or colorjs.io `Color`. Omit `opacity` to preserve it; otherwise clamped to `[0, 1]`.
- `asString`: defaults to `rgba(r,g,b,a)`; pass `"hex"` for 6-digit hex (no opacity).
- `opacity`: clamped to `[0, 1]` on write.

```ts
brush.primary.set("#FF6600");
brush.primary.opacity = 0.8;
brush.secondary.set("#3366FF", 1);
```

---

### `swapColors`

```ts
swapColors(): void
```

Swaps `primary` ↔ `secondary` (color and opacity).

---

### `size`

```ts
get size(): number
set size(size: number)
```

Brush size in pixels. Clamped to `[1, maxSize]`.

---

### `colorInline`

```ts
get colorInline(): string
set colorInline(color: ColorInput)
```

Inner stroke color of the SVG brush cursor overlay.

---

### `colorOutline`

```ts
get colorOutline(): string
set colorOutline(color: ColorInput)
```

Outer stroke color of the SVG brush cursor overlay.

---

### `affectedPixels`

```ts
affectedPixels(cx: number, cy: number): IterableIterator<Vec2>
```

Yields texture-space `{ x, y }` coords for every pixel in the brush square at `(cx, cy)`. Single-use: iterate once or spread into an array.

- Odd size: center is exactly `(cx, cy)`.
- Even size: offset by `-0.5` to stay grid-aligned.

```ts
// size = 3 → 9 pixels around (10, 10)
canvasBuffer.drawPixels(brush.affectedPixels(10, 10), { r: 255, g: 0, b: 0, a: 255 });
// Reuse:
const pixels = [...brush.affectedPixels(10, 10)];
```
