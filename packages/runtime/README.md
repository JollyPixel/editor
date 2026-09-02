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
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />z
</head>

<canvas tabindex="-1"></canvas>

<script type="module" src="./src/main.ts"></script>

</html>
```

> [!TIP]
> The `tabindex="-1"` attribute on the canvas allows it to receive keyboard focus, which is required for capturing input events.

Then in your main script, create a `Runtime` instance and call `loadRuntime` to bootstrap everything:

- GPU detection
- Loading splash screen
- World (automatically handle the loop)

```ts
import {
  Runtime,
  loadRuntime
} from "@jolly-pixel/runtime";

const runtime = await Runtime.create("canvas", {
  // Displays the JollyPixel performance HUD during development.
  includePerformanceStats: true,
  // Keeps keyboard focus on the canvas while the runtime is running.
  focusCanvas: true,
  assets: {
    catalog: "/assets.json"
  }
});

// The world gives you access to the engine systems
// (scene, renderer, input, etc.)
const { world } = runtime;

// loadRuntime will detect the GPU, load the scene's declared assets,
// queue the scene, then start the game loop.
loadRuntime(runtime, { scene: new GameScene() })
  .catch(console.error);
```

Vite serves `/assets.json` from `public/assets.json` during development and
copies it to the build output. `Runtime.create()` fetches and parses the
catalog before it constructs the world.

For a more comprehensive illustration, we have created a mini game for [Brackeys 15][brackeys-2026-1]. The official JollyPixel documentation also come with an [Hello World](https://jollypixel.github.io/editor/engine/docs/guides/hello-world.html) guide.

Please refer to the dedicated guides below for additional information specific to your target:

- [Desktop](./docs/platforms/desktop.md)
- [Web](./docs/platforms/web.md)

> [!NOTE]
> The Vite web runtime and the Electron desktop runtime share the exact same HTML file and application code. Only the shell that loads `dist/index.html` differs.

## 📚 API

- [Runtime](./docs/Runtime.md): construction, dynamic asset batches, and scene transitions.
- [SceneManager](../engine/docs/systems/scene-manager.md): scene-load state, progress, and activation gates.

### `loadRuntime(runtime: Runtime, options?: LoadRuntimeOptions)`

Bootstraps the runtime by detecting GPU capabilities, displaying a loading screen, loading all registered assets, and starting the game loop.

Returns a `Promise<void>` that resolves when loading completes. When startup
fails, the loading screen displays the error and the promise rejects with the
same error.

```ts
interface LoadRuntimeOptions<TContext = Systems.WorldDefaultContext> {
  /**
   * Minimum time in milliseconds for which the loading screen is shown.
   * @default 850
   */
  loadingDelay?: number;
  /**
   * Element that contains the loading screen.
   * @default document.body
   */
  loadingContainer?: HTMLElement;
  /** Additional references loaded before startup. */
  assets?: Iterable<AssetReference<unknown>>;
  /** Initial scene loaded and queued before startup. */
  scene?: Systems.Scene<TContext>;
}
```

### 🎨 Loader theme

The runtime uses `jolly-loading` from `@jolly-pixel/ui`. Set its CSS custom
properties on `loadingContainer` or an ancestor. See the
[UI progress and loading documentation](../ui/docs/progress.md#runtime-loading-screen)
for the current property list, defaults, and examples.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[vite]: https://vite.dev/
[electron]: https://www.electronjs.org/
[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[brackeys-2026-1]: https://github.com/JollyPixel/games/tree/main/games/brackeys-2026-1
