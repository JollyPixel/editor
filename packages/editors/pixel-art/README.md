<h1 align="center">
  Pixel-Art Editor
</h1>

<p align="center">
  Reusable pixel-art editor with UI on top of <a href="../../pixel-draw-renderer/">@jolly-pixel/pixel-draw.renderer</a>
</p>

## 📌 About

`<pixel-draw-panel>` and friends: a Lit-based toolbar (mode rail, colors, undo/redo, import/export, UV toolbar) wired to a [`PixelArtCanvas`][pixel-draw-renderer].

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/editor.pixel-art
# or
$ yarn add @jolly-pixel/editor.pixel-art
```

## 👀 Usage Example

```ts
import "@jolly-pixel/editor.pixel-art";
import type {
  PixelDrawPanel
} from "@jolly-pixel/editor.pixel-art";
```

```html
<pixel-draw-panel style="width: 640px; height: 480px;"></pixel-draw-panel>
```

```ts
const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel")!;
const canvas = await panel.initialize({
  texture: {
    size: {
      x: 64,
      y: 64
    }
  },
  defaultMode: "paint"
});
```

> [!TIP]
> See [Voxel-Map](../voxel-map/README.md) editor for a live integration on this editor.

## 🚀 Running the example

`examples/` is a Lit toolbar panel driving `PixelArtCanvas` and painting live
Cube and Ramp previews in Three.js, with multiplayer sync via
`@jolly-pixel/network`.

The demo keeps application wiring in `examples/scripts/main.ts`, theme and
collaboration integration in `examples/scripts/demo/`, and UV-driven Three.js
rendering in `examples/scripts/preview/`. Shape-specific geometry lives under
`preview/shapes/`; the gallery, picker, UV projection, and animation remain
shape-neutral.

```bash
npm run dev -w @jolly-pixel/editor.pixel-art
```

Open `http://localhost:3000` to see the interactive demo.

## 📚 API

- [`PixelDrawPanel`](./docs/ui/PixelDrawPanel.md): drop-in UI (`<pixel-draw-panel>`)

## 🧪 Running the E2E tests

```bash
npm run test:e2e -w @jolly-pixel/editor.pixel-art
```

Playwright drives the `examples/` demo (started automatically via `webServer`) and exercises paint, fill, select, move, colors, history, and import/export through the actual UI, not internal APIs.

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
[contributing]: ../../../CONTRIBUTING.md
[pixel-draw-renderer]: https://github.com/JollyPixel/editor/tree/main/packages/pixel-draw-renderer
[voxel-map]: https://github.com/JollyPixel/editor/tree/main/packages/editors/voxel-map
