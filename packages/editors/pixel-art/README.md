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

The demo boots through [`@jolly-pixel/editor.host`](../host/README.md):
`examples/scripts/main.ts` hands its definition to `mountStandalone()`, which
opens the session on the launch target (the seeded `demo-canvas` asset, or
`?target=<assetId>`). `examples/scripts/boot/` builds the target document,
the preview and the texture tabs, which lease every added texture from the
session. UV-driven Three.js rendering lives in `examples/scripts/preview/`. Shape-specific geometry lives under
`preview/shapes/`; the gallery, picker, UV projection, and animation remain
shape-neutral.

```bash
pnpm --filter @jolly-pixel/editor.pixel-art dev
```

Open `http://localhost:3000` to see the interactive demo.

## 📚 API

- [`PixelDrawPanel`](./docs/panel/PixelDrawPanel.md): drop-in UI (`<pixel-draw-panel>`)

## 🧪 Running the E2E tests

```bash
pnpm --filter @jolly-pixel/editor.pixel-art test:e2e
```

Playwright drives the `examples/` demo (started automatically via `webServer`) and exercises paint, fill, select, move, colors, history, and import/export through the actual UI, not internal APIs.

Each test creates its own blank canvas through the catalog and opens the demo on it, so tests share no state. Only the `3D preview` tests boot the runtime; they pass `?max-fps=` (`kRuntimeMaxFps` in `test/e2e/fixtures.ts`) to the demo. Headless Chromium renders that scene in software at roughly 300ms a frame, so any cap above ~2 fps renders back to back, starves the main thread and stalls every dispatched input event.

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ pnpm run test
$ pnpm run lint
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
