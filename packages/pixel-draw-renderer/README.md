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
- **Flexible color input** — every color option accepts a CSS color string (hex, `rgb()`, `hsl()`, named color, ...) or a [colorjs.io](https://colorjs.io) `Color` instance
- **Color picking** — right-click eyedropper that reads the master canvas pixel
- **Transparency support** — configurable checkerboard background renders beneath transparent pixels
- **SVG brush highlight** — grid-aligned SVG overlay tracks the cursor in real time
- **Shift-to-line drawing** — hold `Shift` in paint mode to preview a straight path from a fixed start point to the cursor, then commit it as a brush-stamped line
- **Paint-bucket fill** — click in `"fill"` mode to flood-fill the connected region of same-colored pixels under the cursor, respecting the brush's current color and opacity
- **Dual-canvas architecture** — a master canvas (full resolution, off-screen) and a working canvas (viewport-cropped, on-screen) maintain pixel-perfect fidelity at any zoom level
- **Mode switching** — `"paint"`, `"move"`, and `"fill"` modes control how mouse events are interpreted

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
manager.canvasBuffer.drawPixels(
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

Color options accept a plain CSS string or a [colorjs.io](https://colorjs.io) `Color` instance:

```ts
import Color from "colorjs.io";

manager.brush.setColor(new Color("oklch(70% 0.15 50)"));
manager.brush.setColor("rebeccapurple");
```

### Switching modes

```ts
manager.setMode("move");  // left-click pans
manager.setMode("paint"); // left-click draws
```

### Drawing straight lines (Shift)

In `"paint"` mode, holding `Shift` arms a straight-line tool anchored at the cursor position when the key was pressed. Moving the mouse previews the path as a thin, outlined SVG line through the pixel centers (visible on any background); the next `mousedown` commits it as a brush-stamped, rasterized line in a single history entry. Releasing `Shift` before committing cancels the preview. This is wired up automatically — no extra setup is required beyond being in `"paint"` mode. See [LineTool.md](./docs/LineTool.md) for the underlying state machine.

### Filling a region (paint bucket)

```ts
manager.setMode("fill");
```

In `"fill"` mode, a left-click flood-fills the 4-directionally connected region of pixels that share the clicked pixel's exact color with the brush's current color and opacity — the same behavior as the bucket tool in MS Paint/GIMP/Photoshop. A diagonal line of a different color blocks the fill from leaking through a diagonal gap. Clicking a region that's already the fill color is a no-op — nothing is drawn and no `"stroke"` event fires. See [FillTool.md](./docs/FillTool.md) for the underlying algorithm.

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
| `CanvasBuffer` | Dual-canvas pixel storage and image-data access |
| `CanvasRenderer` | Visible canvas drawing and checkerboard background |
| `InputController` | Translates raw mouse/keyboard events into semantic, coordinate-resolved actions — doesn't interpret what they mean for any tool |
| `SvgManager` | SVG brush-highlight and line-preview overlay |
| [`LineTool`](./docs/LineTool.md) | Shift-to-line armed-state machine and Bresenham rasterization |
| [`FillTool`](./docs/FillTool.md) | Paint-bucket flood-fill algorithm |

## Troubleshooting

**Canvas is blank after mounting**
Call `manager.resize()` after `reparentCanvasTo()` to let the renderer read the parent element's dimensions, then call `manager.centerTexture()`.

**Pixels appear at the wrong position**
Pass `{ bounds: canvas.getBoundingClientRect() }` when calling `viewport.getMouseTexturePosition()`. Stale bounding rects cause offset errors.

**Master canvas is slow to initialize**
`CanvasBuffer` pre-allocates a canvas at `maxSize` (default `2048`). In test environments or when large textures are unnecessary, set `texture.maxSize` to a smaller value such as `64`.

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
