# BrushManager

`BrushManager` manages the current brush color, opacity, size, and highlight colors, and computes the list of texture-space pixels a brush stroke covers.

## Import

```ts
import { BrushManager } from "@jolly-pixel/pixel-draw.renderer";
```

## Constructor

```ts
new BrushManager(options: BrushManagerOptions)
```

### `BrushManagerOptions`

| Property | Type | Default | Description |
|---|---|---|---|
| `color` | `string` | `"#000000"` | Initial brush color (CSS hex) |
| `size` | `number` | `1` | Initial brush size in pixels |
| `maxSize` | `number` | `32` | Upper bound for brush size |
| `highlightColorInline` | `string` | `"#FFFFFF"` | SVG overlay inner stroke color |
| `highlightColorOutline` | `string` | `"#000000"` | SVG overlay outer stroke color |

## Properties

| Property | Type | Description |
|---|---|---|
| `color` | `string` | Current brush color as a CSS hex string |
| `opacity` | `number` | Current opacity in the range `[0, 1]` |
| `size` | `number` | Current brush size in pixels |
| `maxSize` | `number` | Maximum allowed brush size |
| `r` / `g` / `b` | `number` | Current color channels in the range `[0, 255]` |

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
