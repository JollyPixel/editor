<h1 align="center">
  pixel-draw.renderer
</h1>

<p align="center">
  JollyPixel Pixel Art canvas renderer
</p>

## 📌 About

Browser-based library for editing pixel-art textures: brush, fill, select, and UV region tools, undo/redo, zoom/pan, and optional real-time multiplayer sync, all behind a single `PixelArtCanvas` API.

## 💡 Features

- **Brush painting**: adjustable size, opacity, and primary/secondary color (CSS string or a [colorjs.io][colorjs] `Color` instance)
- **Paint-bucket fill**: flood-fill a connected region of same-colored pixels
- **Rectangle select**: drag to select a region
- **UV regions**: create/move/delete rectangular UV regions independently of painting, via the `uv` value object;
- **Undo/redo**: optional bounded history over strokes, resizes, texture replaces, and UV region changes;
- **Zoom & pan**: mouse-wheel and trackpad-pinch zoom with configurable sensitivity and range;
- **Transparency support**: checkerboard background renders beneath transparent pixels
- **Network sync**: transport-agnostic, server-authoritative multiplayer. Multiple clients can paint the same texture in real time

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/pixel-draw.renderer
# or
$ yarn add @jolly-pixel/pixel-draw.renderer
```

## 👀 Usage Example

```ts
import {
  PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";

const container = document.getElementById("editor-container")!;
const manager = new PixelArtCanvas(container, {
  texture: {
    size: { x: 64, y: 64 }
  },
  defaultMode: "paint",
  backgroundColor: "#263238",
  zoom: {
    // No `default`: computed to fit the whole texture inside `container`.
    min: 1,
    max: 32
  },
  brush: {
    size: 3
  },
  history: {
    enabled: true
  }
});

manager.onResize();
manager.centerTexture();

manager.brush.primary.set("#FF6600", 0.8);
manager.brush.secondary.set("#3366FF");
manager.mode = "fill";
```

Loading an existing texture:

```ts
const img = new Image();
img.src = "/assets/sprite.png";
await img.decode();
manager.texture = img;
```

> See [`examples/`](./examples) for a full demo (a Lit-based toolbar panel driving `PixelArtCanvas` and painting a live Three.js texture).

### Modes

`mode` selects how left-click/drag is interpreted.

- `"paint"`: draw with the brush
- `"move"`: pan the camera
- `"fill"`: flood-fill the clicked region
- `"select"`: select, move, copy, and delete a rectangular region
- `"uv"`: select and drag UV regions; regions are created programmatically via `manager.uv.create(...)`, not by clicking

Panning and zooming (mouse wheel, trackpad pinch/drag) work from any mode, regardless of the current `mode`.

> [!TIP]
> Read [PixelArtCanvas.md](./docs/PixelArtCanvas.md#mode) for the full behavior, and the [Keybinds](#keybinds) section below for exact shortcuts.

### Keybinds

`Shift` (line draw) and `Space` (pan) are not **configurable** but everything below is:

| Action | Default |
|---|---|
| Copy | `Ctrl`/`Cmd`+`C` |
| Paste | `Ctrl`/`Cmd`+`V` |
| Undo | `Ctrl`/`Cmd`+`Z` |
| Redo | `Ctrl`/`Cmd`+`Y` or `Ctrl`/`Cmd`+`Shift`+`Z` |
| Delete | `Delete` |
| Rotate selection | `R` |
| Flip selection horizontal | `H` |
| Flip selection vertical | `V` |

Override at construction, or live via `keybindings.patch()`:

```ts
const manager = new PixelArtCanvas(container, {
  keybindings: {
    undo: "alt+u"
  } // unspecified actions keep their default
});

manager.keybindings.patch({
  redo: "alt+shift+u"
});
```

> [!TIP]
> Read [input/Keybindings.md](./docs/input/Keybindings.md) for the combo string format and error handling.

### Undo/redo

Disabled by default. Enable it and (optionally) track button-enabled state:

```ts
const manager = new PixelArtCanvas(container, {
  history: {
    enabled: true,
    // limit defaults to 10
    limit: 20
  },
  onHistoryChange: ({ canUndo, canRedo }) => {
    undoButton.disabled = !canUndo;
    redoButton.disabled = !canRedo;
  }
});

manager.undo(); // false if history is disabled or there's nothing to undo
manager.redo();
```

> [!TIP]
> Read [PixelArtCanvas.md](./docs/PixelArtCanvas.md#undo--redo--canundo--canredo) and [history/HistoryStack.md](./docs/history/HistoryStack.md).

## 🚀 Running the example

```bash
npm run dev -w @jolly-pixel/pixel-draw.renderer
```

Open `http://localhost:5173` to see the interactive demo.

## 📚 API

- [`PixelArtCanvas`](./docs/PixelArtCanvas.md)
  - [`Brush`](./docs/tools/Brush.md)
  - [`BrushTool`](./docs/tools/BrushTool.md)
  - [`FillTool`](./docs/tools/FillTool.md)
  - [`SelectTool`](./docs/tools/SelectTool.md)
- [`PixelBuffer`](./docs/buffer/PixelBuffer.md)
- [`Keybindings`](./docs/input/Keybindings.md)
- [`Network`](./docs/network/index.md)

### Advanced / Internal

Useful, but generally more internal-facing APIs:

- [`UVMap`](./docs/uv/UVMap.md)
- [`HistoryStack`](./docs/history/HistoryStack.md)

## 🧩 Types

Shared value types used across the public API:

```ts
type Vec2 = {
  x: number;
  y: number;
};

type Mode = "paint" | "move" | "fill" | "select" | "uv";

interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RGBA { r: number; g: number; b: number; a: number; }
```

`Vec2` is a texture- or canvas-space coordinate depending on context. `SelectionRect` is always texture-space, used by `PixelBuffer.drawRegion` and the built-in select tool. Color options also accept `ColorInput` (`string | Color`, [colorjs.io][colorjs]'s class) — a CSS color string or a `Color` instance — but that alias isn't itself exported by name.

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
[colorjs]: https://colorjs.io
