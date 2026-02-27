# BrushManager

`BrushManager` manages the current brush color, opacity, size, and highlight colors, and computes the list of texture-space pixels a brush stroke covers.

## Types

```ts
new BrushManager(options: BrushManagerOptions)

export interface BrushManagerOptions {
  /**
   * Base color of the brush. Can be any valid CSS color string.
   * Opacity can be controlled separately with the `opacity` property.
   * @default "#000000"
   */
  color?: string;
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
    colorInline?: string;
    colorOutline?: string;
  };
}
```

## Methods

### `setColor`

```ts
setColor(color: string): void
```

Sets the brush color from a CSS hex string (e.g. `"#FF0000"`). Updates the internal `r`, `g`, `b` components accordingly.

---

### `setOpacity`

```ts
setOpacity(opacity: number): void
```

Sets the brush opacity. Values are clamped to `[0, 1]`.

---

### `setSize`

```ts
setSize(size: number): void
```

Sets the brush size in pixels. Values are clamped to `[1, maxSize]`.

---

### `getHighlightColorInline` / `setHighlightColorInline`

```ts
getHighlightColorInline(): string
setHighlightColorInline(color: string): void
```

Gets or sets the inner stroke color of the SVG brush cursor overlay.

---

### `getHighlightColorOutline` / `setHighlightColorOutline`

```ts
getHighlightColorOutline(): string
setHighlightColorOutline(color: string): void
```

Gets or sets the outer stroke color of the SVG brush cursor overlay.

---

### `getAffectedPixels`

```ts
getAffectedPixels(cx: number, cy: number): Vec2[]
```

Returns an array of texture-space `{ x, y }` coordinates for every pixel within the current brush square centered at `(cx, cy)`.

- For **odd** brush sizes the center pixel is exactly `(cx, cy)`.
- For **even** brush sizes the brush is offset by `−0.5` to remain grid-aligned.

**Example**

```ts
// size = 3 → 9 pixels around (10, 10)
const pixels = brush.getAffectedPixels(10, 10);
textureBuffer.drawPixels(pixels, { r: 255, g: 0, b: 0, a: 255 });
```
