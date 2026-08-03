<h1 align="center">
  Pixel-Art Editor
</h1>

<p align="center">
  Reusable pixel-art UI on top of @jolly-pixel/pixel-draw.renderer
</p>

## 📌 About

`<pixel-draw-panel>` and friends: a Lit-based toolbar (mode rail, colors, undo/redo, import/export, UV toolbar) wired to a [`PixelArtCanvas`][pixel-draw-renderer].

## 💃 Getting Started

This package is private and not published to npm. Add it as a workspace dependency instead:

```json
{
  "dependencies": {
    "@jolly-pixel/editor.pixel-art": "2.0.0"
  }
}
```

## 👀 Usage Example

```ts
import "@jolly-pixel/editor.pixel-art";
import type { PixelDrawPanel } from "@jolly-pixel/editor.pixel-art";
```

```html
<pixel-draw-panel style="width: 640px; height: 480px;"></pixel-draw-panel>
```

```ts
const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel")!;
const canvas = await panel.initialize({
  texture: {
    size: { x: 64, y: 64 }
  },
  defaultMode: "paint"
});
```

See [PixelDrawPanel.md](./docs/ui/PixelDrawPanel.md) for the full API, including the individually-exported sub-elements (`ModeRail`, `ColorPickerRail`, `ColorSwatch`) if you want to compose your own layout instead of the full panel.

## 🚀 Running the example

`examples/` is a Lit toolbar panel driving `PixelArtCanvas` and painting a live Three.js texture, with optional multiplayer sync via `@jolly-pixel/network`.

```bash
npm run dev -w @jolly-pixel/editor.pixel-art
```

Open `http://localhost:3000` to see the interactive demo.

## 🧪 Running the E2E tests

```bash
npm run test:e2e -w @jolly-pixel/editor.pixel-art
```

Playwright drives the `examples/` demo (started automatically via `webServer`) and exercises paint, fill, select, move, colors, history, and import/export through the actual UI, not internal APIs.

## 📚 API

- [`PixelDrawPanel`](./docs/ui/PixelDrawPanel.md): drop-in UI (`<pixel-draw-panel>`)

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

[contributing]: ../../../CONTRIBUTING.md
[pixel-draw-renderer]: https://github.com/JollyPixel/editor/tree/main/packages/pixel-draw-renderer
[voxel-map]: https://github.com/JollyPixel/editor/tree/main/packages/editors/voxel-map
