<h1 align="center">
  pixel-draw.renderer
</h1>

<p align="center">
  JollyPixel Pixel Art canvas renderer
</p>

## 📌 About

Browser-based library for editing pixel-art textures. It provides zoom, pan, brush painting, right-click color picking, and an SVG cursor overlay.

## 💡 Features

- **Brush painting**: adjustable size, color, and opacity; color inputs accept a CSS string or a [colorjs.io](https://colorjs.io) `Color` instance; right-click eyedropper picks a color from the canvas
- **Shift-to-line drawing**: hold `Shift` in paint mode to draw a straight line
- **Paint-bucket fill**: flood-fill a connected region of same-colored pixels
- **Rectangle select, move, copy, delete**: `Ctrl`/`Cmd`+`C`/`V` to copy/duplicate, `Delete` to erase
- **Zoom & pan**: mouse-wheel zoom with configurable sensitivity and range; middle-click pan in any mode
- **Transparency support**: checkerboard background renders beneath transparent pixels

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/pixel-draw.renderer
# or
$ yarn add @jolly-pixel/pixel-draw.renderer
```

## 👀 Usage Example

```ts
import { CanvasManager } from "@jolly-pixel/pixel-draw.renderer";

const container = document.getElementById("editor-container")!;
const manager = new CanvasManager(container, {
  texture: {
    size: { x: 64, y: 64 }
  },
  zoom: {
    default: 4,
    min: 0.5,
    max: 40
  }
});

manager.onResize();
manager.centerTexture();

manager.brush.setColor("#FF6600"); // CSS string or a colorjs.io `Color` instance
manager.brush.setOpacity(0.8);
manager.brush.setSize(3);

manager.setMode("fill"); // "paint" | "move" | "fill" | "select", see Modes below
```

Loading an existing texture:

```ts
const img = new Image();
img.src = "/assets/sprite.png";
await img.decode();
manager.setTexture(img);
```

### Modes

`setMode()` selects how left-click/drag is interpreted. See [CanvasManager.md](./docs/CanvasManager.md#getmode--setmode) for the full behavior:

- `"paint"`: draws with the [brush](./docs/tools/Brush.md); hold `Shift` for a straight line
- `"move"`: pans the camera
- `"fill"`: flood-fills the clicked region
- `"select"`: drag to select/move; `Ctrl`/`Cmd`+`C`/`V` copy/paste, `Delete` erases

Middle-click pans and right-click picks a color in any mode.

## 🚀 Running the example

```bash
npm run dev -w @jolly-pixel/pixel-draw.renderer
```

Open `http://localhost:5173` to see the interactive demo.

## 📚 API

- [`CanvasManager`](./docs/CanvasManager.md): top-level coordinator, the primary public API
- [`Brush`](./docs/tools/Brush.md): brush size, color, opacity, and affected-pixel computation — read/write via `CanvasManager.brush`
- [`PixelBuffer`](./docs/buffer/PixelBuffer.md): headless RGBA pixel storage, usable server-side with no DOM
- [buffer hooks](./docs/buffer/hooks.md): `PixelBufferHookEvent`/`PixelBufferHookListener`, the local-mutation event shape used by `onBufferUpdated`/`applyRemoteCommand`
- [Network Sync Layer](./docs/network/index.md): transport-agnostic, server-authoritative multiplayer for `CanvasManager`
- [`types`](./docs/types.md): shared value types (`Vec2`, `RGBA`, `SelectionRect`, `Mode`)

Line/fill/select drawing tools, the viewport, canvas renderer, SVG overlay, and input handling are internal implementation details wired together by `CanvasManager` — they aren't part of the public API.

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
