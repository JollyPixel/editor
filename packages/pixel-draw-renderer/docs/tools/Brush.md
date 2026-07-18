# Brush

`Brush` manages the current brush color, opacity, size, and highlight colors, and computes the list of texture-space pixels a brush stroke covers.

## Types

```ts
new Brush(options: BrushOptions)

export type ColorInput = string | Color; // Color is colorjs.io's Color class

export interface BrushOptions {
  /**
   * Base color of the brush. Accepts a CSS color string (hex, rgb(), hsl(),
   * named color, ...) or a colorjs.io `Color` instance.
   * Opacity can be controlled separately with the `opacity` property.
   * @default "#000000"
   */
  color?: ColorInput;
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

## Methods

### `color`

```ts
color(color: ColorInput, opacity?: number): void
```

Sets the brush color from a CSS color string (hex, rgb(), hsl(), named color, ...) or a colorjs.io `Color` instance. If `opacity` is omitted, the current opacity is preserved; otherwise it's clamped to `[0, 1]` and applied alongside the new color.

---

### `colorAsString`

```ts
colorAsString(format?: "rgba" | "hex"): string
```

Returns the current brush color. Defaults to an `rgba(r, g, b, a)` string; pass `"hex"` to get a 6-digit hex string instead (opacity is not represented in hex output).

---

### `opacity`

```ts
get opacity(): number
set opacity(opacity: number)
```

The brush opacity. Assigned values are clamped to `[0, 1]`.

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
