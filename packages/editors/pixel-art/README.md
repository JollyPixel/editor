<p align="center">
  <img src="./docs/banner.png" alt="JollyPixel">
</p>

## 📌 About

`<pixel-draw-panel>` is the Lit UI for a [`PixelArtCanvas`][pixel-draw-renderer].
This workspace also contains the studio editor page and Three.js adapters for
canvas and UV-region texturing.

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
> See [Voxel-Map](../voxel-map/README.md) or [Voxel-Model](../voxel-model/README.md) for a live integrations on this library/editor.

## 📚 API

- [`PixelDrawPanel`](./docs/panel/PixelDrawPanel.md): component API and events
- [Pixel-art key bindings](./docs/keybindings/PixelArtKeyBindings.md): shortcuts and the console `pixelart.keybinds` namespace
- [`UvNetLibrary`](./docs/uv/UvNetLibrary.md): the UV nets regions unfold with, and the console `pixelart.nets` namespace
- [Mesh texturing](./docs/mesh-texturing/README.md): canvas, normal-map and UV geometry adapters

## 🖼️ Editor page

`page/` is the editor the studio opens for `pixelart` assets.

```bash
pnpm --filter @jolly-pixel/editor.pixel-art dev
pnpm --filter @jolly-pixel/editor.pixel-art build:page
```

The dev server is a playground with a 3D preview, a starter UV region, UV
create/delete/resize and the `ask` import policy. `?runtime=off`, `?empty` and
`?import-policy=` change it. The built page has none of these.

## 🧪 Running the E2E tests

```bash
pnpm --filter @jolly-pixel/editor.pixel-art test:e2e
```

The `3D preview` tests cap the runtime at 1 fps (`kRuntimeMaxFps`): headless
Chromium renders the scene in software, and a higher cap stalls input events.

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
