# Viewport

`Viewport` encapsulates camera position, zoom level, canvas dimensions, and all coordinate-space conversions between canvas pixels and texture pixels.

## Import

```ts
import { Viewport } from "@jolly-pixel/pixel-draw.renderer";
```

## Constructor

```ts
new Viewport(options: ViewportOptions)
```

### `ViewportOptions`

| Property | Type | Default | Description |
|---|---|---|---|
| `textureSize` | `number` | — | Initial texture size in pixels |
| `zoom.range` | `[min, max]` | `[0.5, 40]` | Allowed zoom multiplier range |
| `zoom.sensitivity` | `number` | `0.002` | Wheel-delta to zoom-multiplier conversion factor |

## Properties

| Property | Type | Description |
|---|---|---|
| `zoom` | `number` | Current zoom multiplier, clamped to `zoom.range` |
| `camera` | `Vec2` | Current camera offset in canvas pixels |
| `canvasWidth` | `number` | Tracked canvas width; updated by `setCanvasSize` |
| `canvasHeight` | `number` | Tracked canvas height; updated by `setCanvasSize` |
| `textureSize` | `number` | Current texture size in pixels |

## Methods

### `applyZoom`

```ts
applyZoom(delta: number, originX: number, originY: number): void
```

Adjusts the zoom level by `delta` (wheel units × sensitivity), keeping the point at `(originX, originY)` in canvas space fixed on screen.

---

### `applyPan`

```ts
applyPan(dx: number, dy: number): void
```

Translates the camera by `(dx, dy)` pixels in canvas space.

---

### `setCanvasSize`

```ts
setCanvasSize(width: number, height: number): void
```

Updates the tracked canvas dimensions. Call this whenever the visible canvas is resized.

---

### `setTextureSize`

```ts
setTextureSize(size: number): void
```

Updates the tracked texture size used in UV and screen-rect computations.

---

### `center`

```ts
center(): void
```

Resets the camera so the texture is centered in the current canvas.

---

### `getMouseCanvasPosition`

```ts
getMouseCanvasPosition(mx: number, my: number): Vec2
```

Converts a raw mouse event position (relative to the page) to canvas-local coordinates by subtracting the canvas bounding-rect offset.

---

### `getMouseTexturePosition`

```ts
getMouseTexturePosition(
  mx: number,
  my: number,
  opts: { bounds: DOMRect; limit?: boolean }
): Vec2
```

Converts a mouse position to texture-space pixel coordinates at the current zoom and camera offset.

- `bounds` — the canvas `DOMRect` obtained from `canvas.getBoundingClientRect()`
- `limit` — when `true`, clamps the result to `[0, textureSize - 1]`

**Example**

```ts
canvas.addEventListener("mousemove", (e) => {
  const bounds = canvas.getBoundingClientRect();
  const pos = viewport.getMouseTexturePosition(e.clientX, e.clientY, { bounds, limit: true });
  console.log(pos.x, pos.y); // texture-space coordinates
});
```

---

### `getTextureScreenRect`

```ts
getTextureScreenRect(): { x: number; y: number; width: number; height: number }
```

Returns the screen-space rectangle occupied by the texture at the current zoom and camera position. Useful for rendering the checkerboard background clip region or positioning DOM overlays.
