# README.md

<h1 align="center">
  pixel-draw.renderer
</h1>

<p align="center">
  JollyPixel Pixel Art canvas renderer
</p>

## About

`@jolly-pixel/pixel-draw.renderer` is a browser-based library for editing pixel-art textures. It provides zoom, pan, brush painting, right-click color picking, and an SVG cursor overlay, built around a SOLID-structured class architecture.

## Features

- **Zoom & pan** — smooth mouse-wheel zoom with configurable sensitivity and range; middle-click pan in any mode
- **Brush painting** — configurable square brush with adjustable size, color, and opacity
- **Color picking** — right-click eyedropper that reads the master canvas pixel
- **Transparency support** — configurable checkerboard background renders beneath transparent pixels
- **SVG brush highlight** — grid-aligned SVG overlay tracks the cursor in real time
- **Dual-canvas architecture** — a master canvas (full resolution, off-screen) and a working canvas (viewport-cropped, on-screen) maintain pixel-perfect fidelity at any zoom level
- **Mode switching** — `"paint"` and `"move"` modes control how mouse events are interpreted

## Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/pixel-draw.renderer
# or
$ yarn add @jolly-pixel/pixel-draw.renderer
```

## Usage Examples

### Minimal setup

```ts
import { CanvasManager } from "@jolly-pixel/pixel-draw.renderer";

const manager = new CanvasManager({
  texture: { size: 64 },
  zoom: {
    range: [0.5, 40],
    sensitivity: 0.002
  },
});

const container = document.getElementById("editor-container")!;
manager.reparentCanvasTo(container);
manager.resize();
manager.centerTexture();
```

### Drawing pixels programmatically

```ts
import { CanvasManager } from "@jolly-pixel/pixel-draw.renderer";

const manager = new CanvasManager({
  texture: { size: 32 }
});
manager.reparentCanvasTo(document.body);

// Draw a red pixel at texture position (10, 10)
manager.textureBuffer.drawPixels(
  [{ x: 10, y: 10 }],
  { r: 255, g: 0, b: 0, a: 255 }
);
manager.render();
```

### Loading an existing texture

```ts
const img = new Image();
img.src = "/assets/sprite.png";
await img.decode();

manager.setTexture(img);
```

### Configuring the brush

```ts
manager.brush.setColor("#FF6600");
manager.brush.setOpacity(0.8);
manager.brush.setSize(3);
```

### Switching modes

```ts
manager.setMode("move");  // left-click pans
manager.setMode("paint"); // left-click draws
```

## Running the Examples

```bash
npm run dev -w @jolly-pixel/pixel-draw.renderer
```

Open `http://localhost:5173` to see the interactive demo.

## API

| Class | Description |
|---|---|
| [`CanvasManager`](./docs/CanvasManager.md) | Top-level coordinator — the primary public API |
| [`Viewport`](./docs/Viewport.md) | Camera position, zoom level, and coordinate transforms |
| [`BrushManager`](./docs/BrushManager.md) | Brush size, color, opacity, and affected-pixel computation |
| `TextureBuffer` | Dual-canvas pixel storage and image-data access |
| `CanvasRenderer` | Visible canvas drawing and checkerboard background |
| `InputController` | Mouse event routing to drawing and pan actions |
| `SvgManager` | SVG brush-highlight overlay |

## Troubleshooting

**Canvas is blank after mounting**
Call `manager.resize()` after `reparentCanvasTo()` to let the renderer read the parent element's dimensions, then call `manager.centerTexture()`.

**Pixels appear at the wrong position**
Pass `{ bounds: canvas.getBoundingClientRect() }` when calling `viewport.getMouseTexturePosition()`. Stale bounding rects cause offset errors.

**Master canvas is slow to initialize**
`TextureBuffer` pre-allocates a canvas at `maxSize` (default `2048`). In test environments or when large textures are unnecessary, set `texture.maxSize` to a smaller value such as `64`.

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ npm run test
$ npm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## License

MIT

<!-- Reference-style links for DRYness -->

[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[contributing]: ../../CONTRIBUTING.md


# BrushManager.md

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


# CanvasManager.md

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
setTexture(img: HTMLImageElement): void
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


# Viewport.md

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


