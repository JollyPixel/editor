<h1 align="center">
  runtime
</h1>

<p align="center">
  JollyPixel Three.js runtime
</p>

## 💡 Features

- Web runtime with [Vite][vite]
- Desktop runtime with [Electron.js][electron]
- Optional themeable performance statistics
- GPU and FPS detection with [detect-gpu](https://github.com/pmndrs/detect-gpu)
- Catalog-backed asset loading with operation-scoped progress

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/runtime
# or
$ yarn add @jolly-pixel/runtime
```

## 👀 Usage example

The runtime needs a `<canvas>` element to render into.

Start by creating an **HTML** file with a canvas and an ECMAScript `module` script entry point:

```html
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Game</title>
  <link rel="stylesheet" href="./main.css">
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
</head>

<canvas tabindex="-1"></canvas>

<script type="module" src="./src/main.ts"></script>

</html>
```

> [!TIP]
> The `tabindex="-1"` attribute on the canvas allows it to receive keyboard focus, which is required for capturing input events.

Then in your main script, create and load a `Runtime`:

- Detect GPU capabilities
- Load startup assets and the initial scene
- Start the world and game loop

```ts
import { Runtime } from "@jolly-pixel/runtime";

const runtime = await Runtime.create("canvas", {
  includePerformanceStats: true,
  focusCanvas: true,
  assets: {
    catalog: new URL("assets.json", document.baseURI)
  }
});

runtime.load({
  scene: new GameScene()
}).catch(console.error);
```

Vite serves `public/assets.json` during development and copies it to the build
output. Resolving the catalog from `document.baseURI` works with both the web
and desktop guides. `Runtime.create()` fetches and parses the catalog before it
constructs the world.

The guides cover runtime setup and customization:

- [Web](./docs/guides/platforms/web.md)
- [Desktop](./docs/guides/platforms/desktop.md)
- [Scenes and assets](./docs/guides/scenes-and-assets.md)
- [Custom asset loaders](./docs/guides/custom-asset-loaders.md)
- [Loading screen](./docs/guides/loading-screen.md)
- [Frame scheduling and performance](./docs/guides/frame-scheduling-and-performance.md)

> [!NOTE]
> The Vite web runtime and the Electron desktop runtime share the same HTML
> file and application code. The desktop build adds a relative Vite base and
> an Electron shell that loads `dist/index.html`.

## 📚 API

- [`Runtime`](./docs/api/Runtime.md): construction, loading, services, and
  lifecycle.
- [Runtime asset options](./docs/api/runtime-assets.md): catalogs and platform
  loaders.
- [`SceneManager`](../engine/docs/systems/scene-manager.md): scene-load state,
  progress, and activation gates.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[vite]: https://vite.dev/
[electron]: https://www.electronjs.org/
[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
