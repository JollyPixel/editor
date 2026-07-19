# Brush

`Brush` manages the primary/secondary brush colors, size, and highlight colors, and computes the list of texture-space pixels a brush stroke covers. Left-click paints with `primary`; right-click paints with `secondary`.

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

Each is a `BrushColor` value object — a color+opacity pair:

```ts
set(color: ColorInput, opacity?: number): void
asString(format?: "rgba" | "hex"): string
get/set opacity: number
```

- `set(color, opacity?)`: sets the color from a CSS color string or a colorjs.io `Color` instance. If `opacity` is omitted, the current opacity is preserved; otherwise it's clamped to `[0, 1]` and applied alongside the new color.
- `asString(format?)`: returns the color. Defaults to an `rgba(r, g, b, a)` string; pass `"hex"` for a 6-digit hex string (opacity is not represented in hex output).
- `opacity`: clamped to `[0, 1]` on assignment.

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

Exchanges `primary` and `secondary` (color and opacity both).

---

### `size`

```ts
get size(): number
set size(size: number)
```

The brush size in pixels. Assigned values are clamped to `[1, maxSize]`.

---

### `colorInline`

```ts
get colorInline(): string
set colorInline(color: ColorInput)
```

The inner stroke color of the SVG brush cursor overlay.

---

### `colorOutline`

```ts
get colorOutline(): string
set colorOutline(color: ColorInput)
```

The outer stroke color of the SVG brush cursor overlay.

---

### `affectedPixels`

```ts
affectedPixels(cx: number, cy: number): IterableIterator<Vec2>
```

A generator yielding texture-space `{ x, y }` coordinates for every pixel within the current brush square centered at `(cx, cy)`. Lazy and single-use: each call produces a fresh iterator; iterate it once (`for...of`, spread, or pass it directly to something that accepts an `Iterable<Vec2>`) rather than storing and re-reading it.

- For **odd** brush sizes the center pixel is exactly `(cx, cy)`.
- For **even** brush sizes the brush is offset by `−0.5` to remain grid-aligned.

**Example**

```ts
// size = 3 → 9 pixels around (10, 10)
canvasBuffer.drawPixels(brush.affectedPixels(10, 10), { r: 255, g: 0, b: 0, a: 255 });

// Or, if you need to consume the pixels more than once:
const pixels = [...brush.affectedPixels(10, 10)];
```
