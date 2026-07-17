# CanvasManager

`CanvasManager` is the top-level coordinator for the pixel-draw renderer. It wires together the [`Viewport`](./Viewport.md), `CanvasBuffer`, `CanvasRenderer`, `InputController`, and `SvgManager` into a single cohesive public API.

## Types

```ts
new CanvasManager(options?: CanvasManagerOptions)
```

### `CanvasManagerOptions`

| Property | Type | Default | Description |
|---|---|---|---|
| `texture.size` | `number` | `64` | Initial texture size in pixels (square) |
| `texture.defaultColor` | `ColorInput` | transparent black | Fill color used when the texture is cleared. Accepts a CSS color string or a colorjs.io `Color` instance |
| `texture.maxSize` | `number` | `2048` | Maximum texture size; the master canvas is pre-allocated at this size |
| `zoom.range` | `[min, max]` | `[0.5, 40]` | Minimum and maximum zoom multipliers |
| `zoom.sensitivity` | `number` | `0.002` | Wheel-delta multiplier for zoom speed |
| `background.size` | `number` | `8` | Checkerboard tile size in pixels |
| `background.color1` | `ColorInput` | `"#FFFFFF"` | First checkerboard color |
| `background.color2` | `ColorInput` | `"#CCCCCC"` | Second checkerboard color |
| `brush.color` | `ColorInput` | `"#000000"` | Initial brush color. Accepts a CSS color string or a colorjs.io `Color` instance |
| `brush.size` | `number` | `1` | Initial brush size in pixels |
| `brush.maxSize` | `number` | `32` | Maximum brush size |
| `select.eraseColor` | `ColorInput` | `"#FFFFFF"` | Color used to fill the pixels vacated by a Delete or the source side of a Move in `"select"` mode |
| `onDrawEnd` | `() => void` | — | Called after a draw stroke is committed to the master buffer |
| `onBufferUpdated` | `PixelBufferHookListener` | — | Called for every local mutation (stroke, resize, texture replace); see [Network.md](./Network.md) |

`ColorInput` (`type ColorInput = string | Color`) is used throughout the package wherever a color option is accepted: a CSS color string (hex, `rgb()`, `hsl()`, named color, ...) or a [colorjs.io](https://colorjs.io) `Color` instance.

## Properties

### `brush`

```ts
readonly brush: BrushManager
```

The brush manager instance. Use it to read or change the current brush color, opacity, and size.

### `viewport`

```ts
readonly viewport: Viewport
```

The viewport instance. Use it to read zoom and camera position, or to call coordinate-conversion methods directly.

### `canvasBuffer`

```ts
readonly canvasBuffer: CanvasBuffer
```

Direct access to the dual-canvas pixel storage. Useful for programmatic pixel drawing outside of user input.

## Methods

### `getMode` / `setMode`

```ts
getMode(): Mode
setMode(mode: Mode): void
```

Returns or sets the current interaction mode. `"paint"` routes left-click events to brush drawing; `"move"` routes them to panning; `"fill"` routes a left-click to the paint-bucket flood fill (see [FillTool.md](./FillTool.md)); `"select"` routes them to the rectangle-selection tool (see [SelectTool.md](./SelectTool.md)) — drag to select or move, `Ctrl`/`Cmd`+`C`/`V` to copy/duplicate, `Delete` to erase.

Switching away from `"select"` clears any active selection (mirroring how switching to `"move"` cancels an armed Shift-line).

---

### `getSize` / `setSize`

```ts
getSize(): number
setSize(size: number): void
```

Returns or changes the current texture size. `setSize` copies the master canvas content at the new dimensions and resizes the working canvas.

---

### `commitPixels`

```ts
commitPixels(pixels: Vec2[]): void
```

Commits an already-computed pixel set as a single atomic edit: one `drawPixels` call, one redraw, one `"stroke"` hook emission. Used internally by the Shift-to-line tool (see [LineTool.md](./LineTool.md)) to commit a whole rasterized line in one operation instead of redrawing once per point, and by the fill tool (see [FillTool.md](./FillTool.md)) to commit a flood-filled region in one shot. A no-op when `pixels` is empty.

---

### `setTexture`

```ts
setTexture(source: HTMLCanvasElement | HTMLImageElement): void
```

Replaces the texture with the pixel data from `img`. The image is drawn into the master canvas and the working canvas is resized to match.

---

### `getTexture`

```ts
getTexture(): HTMLImageElement
```

Returns an `HTMLImageElement` snapshot of the master canvas at the current texture size.

---

### `getCanvas`

```ts
getCanvas(): HTMLCanvasElement
```

Returns the visible (working) canvas element. Useful for attaching additional event listeners or overlays.

---

### `getCamera`

```ts
getCamera(): Vec2
```

Returns the current camera offset `{ x, y }` in viewport space.

---

### `getZoom`

```ts
getZoom(): number
```

Returns the current zoom multiplier.

---

### `centerTexture`

```ts
centerTexture(): void
```

Pans and positions the camera so the texture is centered in the current viewport.

---

### `reparentCanvasTo`

```ts
reparentCanvasTo(parent: HTMLElement): void
```

Moves the working canvas and the SVG overlay into `parent`. Call this when mounting the editor into a new DOM container.

---

### `resize`

```ts
resize(): void
```

Reads the current dimensions of the parent element and resizes the working canvas to fill it. Call this after the parent element changes size (e.g. on `window.resize`).

---

### `render`

```ts
render(): void
```

Forces an immediate redraw of the visible canvas from the current working texture.

---

### `destroy()`

Destroy the canvas and all related elements (listeners etc)

---

### `onBufferUpdated` / `applyRemoteCommand` / `loadSnapshot`

```ts
set onBufferUpdated(fn: PixelBufferHookListener | undefined)
applyRemoteCommand(event: PixelBufferHookEvent): void
loadSnapshot(size: Vec2, pixels: Uint8ClampedArray): void
```

Network sync hooks, used by `PixelSyncSession` — see [Network.md](./Network.md).
`onBufferUpdated` fires on every local mutation (stroke, resize, texture
replace). `applyRemoteCommand` applies a mutation from a remote peer without
re-firing `onBufferUpdated`. `loadSnapshot` hydrates the buffer from a network
snapshot; it is never itself broadcast.
