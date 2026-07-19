<h1 align="center">
  pixel-draw.renderer
</h1>

<p align="center">
  JollyPixel Pixel Art canvas renderer
</p>

## 📌 About

Browser-based library for editing pixel-art textures. It provides zoom, pan, primary/secondary brush painting, `Ctrl`+right-click color picking, and an SVG cursor overlay.

## 💡 Features

- **Brush painting**: adjustable size, primary/secondary color, and opacity; color inputs accept a CSS string or a [colorjs.io][colorjs] `Color` instance; left-click paints `primary`, right-click paints `secondary`, `Ctrl`+right-click eyedroppers a color from the canvas into `primary`
- **Shift-to-line drawing**: hold `Shift` in paint mode to draw a straight line
- **Paint-bucket fill**: flood-fill a connected region of same-colored pixels
- **Rectangle select, move, copy, delete**: `Ctrl`/`Cmd`+`C`/`V` to copy/duplicate, `Delete` to erase
- **Undo/redo**: optional bounded history over strokes, resizes, and texture replaces; opt in via `history.enabled`
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
import { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

const container = document.getElementById("editor-container")!;
const manager = new PixelArtCanvas(container, {
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

manager.brush.primary.set("#FF6600"); // CSS string or a colorjs.io `Color` instance
manager.brush.primary.opacity = 0.8;
manager.brush.secondary.set("#3366FF");
manager.brush.size = 3;

manager.mode = "fill"; // "paint" | "move" | "fill" | "select", see Modes below
```

Loading an existing texture:

```ts
const img = new Image();
img.src = "/assets/sprite.png";
await img.decode();
manager.texture = img;
```

### Modes

`mode` selects how left-click/drag is interpreted. Read [PixelArtCanvas.md](./docs/PixelArtCanvas.md#mode) for the full behavior:

- `"paint"`: left-click draws with `brush.primary`, right-click draws with `brush.secondary` (mutually exclusive — one button's stroke blocks the other from starting); hold `Shift` for a straight line (always `primary`); `Ctrl`+right-click eyedroppers a color into `brush.primary`
- `"move"`: pans the camera
- `"fill"`: flood-fills the clicked region with `brush.primary`; right-click has no effect
- `"select"`: drag to select/move; `Ctrl`/`Cmd`+`C`/`V` copy/paste, `Delete` erases; right-click has no effect

Middle-click pans in any mode.

### Keybinds

Copy/paste/undo/redo/delete are configurable; Shift (line-tool arm/disarm) is not. Defaults:

| Action | Default |
|---|---|
| Copy | `Ctrl`/`Cmd`+`C` |
| Paste | `Ctrl`/`Cmd`+`V` |
| Undo | `Ctrl`/`Cmd`+`Z` |
| Redo | `Ctrl`/`Cmd`+`Y` or `Ctrl`/`Cmd`+`Shift`+`Z` |
| Delete | `Delete` |

Override at construction, or live via `patchKeybindings()`:

```ts
const manager = new PixelArtCanvas(container, {
  keybindings: { undo: "alt+u" } // unspecified actions keep their default
});

manager.patchKeybindings({ redo: "alt+shift+u" });
```

> [!TIP]
> Read [utils/keybindings.md](./docs/utils/keybindings.md) for the combo string format and error handling.

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

- [`PixelArtCanvas`](./docs/PixelArtCanvas.md): top-level coordinator, the primary public API
- [`Brush`](./docs/tools/Brush.md): brush size, primary/secondary color, opacity, and affected-pixel computation — read/write via `PixelArtCanvas.brush`
- [`PixelBuffer`](./docs/buffer/PixelBuffer.md): headless RGBA pixel storage, usable server-side with no DOM
- [`HistoryStack`](./docs/history/HistoryStack.md): bounded undo/redo stack backing `PixelArtCanvas.undo()`/`redo()`
- [`Keybindings`](./docs/utils/keybindings.md): `Keybindings`/`Keybinding` types, `DEFAULT_KEYBINDINGS`, and the errors thrown by `patchKeybindings()`
- [`Network`](./docs/network/index.md): transport-agnostic, server-authoritative multiplayer for `PixelArtCanvas`

## 🧩 Types

Shared value types used across the public API:

```ts
type Vec2 = {
  x: number;
  y: number;
};

type Mode = "paint" | "move" | "fill" | "select";

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
