# CanvasManager

`CanvasManager` is the top-level coordinator for the pixel-draw renderer. It wires together the [`Viewport`](./Viewport.md), `TextureBuffer`, `CanvasRenderer`, `InputController`, and `SvgManager` into a single cohesive public API.

## Types

```ts
new CanvasManager(options?: CanvasManagerOptions)
```

### `CanvasManagerOptions`

| Property | Type | Default | Description |
|---|---|---|---|
| `texture.size` | `number` | `64` | Initial texture size in pixels (square) |
| `texture.defaultColor` | `{ r, g, b, a }` | transparent black | Fill color used when the texture is cleared |
| `texture.maxSize` | `number` | `2048` | Maximum texture size; the master canvas is pre-allocated at this size |
| `zoom.range` | `[min, max]` | `[0.5, 40]` | Minimum and maximum zoom multipliers |
| `zoom.sensitivity` | `number` | `0.002` | Wheel-delta multiplier for zoom speed |
| `background.size` | `number` | `8` | Checkerboard tile size in pixels |
| `background.color1` | `string` | `"#FFFFFF"` | First checkerboard color |
| `background.color2` | `string` | `"#CCCCCC"` | Second checkerboard color |
| `brush.color` | `string` | `"#000000"` | Initial brush color (CSS hex) |
| `brush.size` | `number` | `1` | Initial brush size in pixels |
| `brush.maxSize` | `number` | `32` | Maximum brush size |

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

### `textureBuffer`

```ts
readonly textureBuffer: TextureBuffer
```

Direct access to the dual-canvas pixel storage. Useful for programmatic pixel drawing outside of user input.

## Methods

### `getMode` / `setMode`

```ts
getMode(): Mode
setMode(mode: Mode): void
```

Returns or sets the current interaction mode. `"paint"` routes left-click events to brush drawing; `"move"` routes them to panning.

---

### `getSize` / `setSize`

```ts
getSize(): number
setSize(size: number): void
```

Returns or changes the current texture size. `setSize` copies the master canvas content at the new dimensions and resizes the working canvas.

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
