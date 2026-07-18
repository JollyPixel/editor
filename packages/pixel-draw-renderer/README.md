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

### Keybinds

Copy/paste/undo/redo/delete are configurable; Shift (line-tool arm/disarm) is not. Defaults:

| Action | Default |
|---|---|
| Copy | `Ctrl`/`Cmd`+`C` |
| Paste | `Ctrl`/`Cmd`+`V` |
| Undo | `Ctrl`/`Cmd`+`Z` |
| Redo | `Ctrl`/`Cmd`+`Y` or `Ctrl`/`Cmd`+`Shift`+`Z` |
| Delete | `Delete` |

Override at construction, or live via `setKeybindings()`:

```ts
const manager = new CanvasManager(container, {
  keybindings: { undo: "alt+u" } // unspecified actions keep their default
});

manager.setKeybindings({ redo: "alt+shift+u" });
```

See [utils/keybindings.md](./docs/utils/keybindings.md) for the combo string format and error handling.

### Undo/redo

Disabled by default. Enable it and (optionally) track button-enabled state:

```ts
const manager = new CanvasManager(container, {
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

See [CanvasManager.md](./docs/CanvasManager.md#undo--redo--canundo--canredo) and [history/HistoryStack.md](./docs/history/HistoryStack.md).

## 🚀 Running the example

```bash
npm run dev -w @jolly-pixel/pixel-draw.renderer
```

Open `http://localhost:5173` to see the interactive demo.

## 📚 API

- [`CanvasManager`](./docs/CanvasManager.md): top-level coordinator, the primary public API
  - [`types`](./docs/types.md): shared value types (`Vec2`, `RGBA`, `SelectionRect`, `Mode`)
- [`Brush`](./docs/tools/Brush.md): brush size, color, opacity, and affected-pixel computation — read/write via `CanvasManager.brush`
- [`PixelBuffer`](./docs/buffer/PixelBuffer.md): headless RGBA pixel storage, usable server-side with no DOM
  - [`hooks`](./docs/buffer/hooks.md): `PixelBufferHookEvent`/`PixelBufferHookListener`, the local-mutation event shape used by `onBufferUpdated`/`applyRemoteCommand`
- [`HistoryStack`](./docs/history/HistoryStack.md): bounded undo/redo stack backing `CanvasManager.undo()`/`redo()`
- [`Keybindings`](./docs/utils/keybindings.md): `Keybindings`/`Keybinding` types, `DEFAULT_KEYBINDINGS`, and the errors thrown by `setKeybindings()`
- [`Network`](./docs/network/index.md): transport-agnostic, server-authoritative multiplayer for `CanvasManager`

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
