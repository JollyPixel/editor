# Viewport

`Viewport` encapsulates camera position, zoom level, canvas dimensions, and all coordinate-space conversions between canvas pixels and texture pixels.

## Types

```ts
new Viewport(options: ViewportOptions)

export interface ViewportOptions {
  /**
   * Size of the texture to display in the viewport.
   * This is used to calculate the camera bounds and the zoom level.
   */
  textureSize: Vec2;
  /**
   * Default zoom level.
   * Can be overridden by passing a texture with a different size than the default one.
   * @default 4
   */
  zoom?: number;
  /**
   * Minimum zoom level. Must be under the max zoom level.
   * @default 1
   */
  zoomMin?: number;
  /**
   * Maximum zoom level. Must be above the min zoom level.
   * @default 32
   */
  zoomMax?: number;
  /**
   * Sensitivity of zooming when using the mouse wheel. The higher, the faster the zoom changes.
   * If the zoom level is under 1, the sensitivity is divided by 10 to allow finer control.
   * @default 0.1
   */
  zoomSensitivity?: number;
}
```

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
