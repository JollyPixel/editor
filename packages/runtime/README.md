<h1 align="center">
  runtime
</h1>

<p align="center">
  JollyPixel Three.js runtime
</p>

## 💡 Features

- Web runtime with [Vite][vite]
- Desktop runtime with [Electron.js][electron]
- Include [stats.js](https://github.com/mrdoob/stats.js)
- GPU and FPS detection with [detect-gpu](https://github.com/pmndrs/detect-gpu)

Commin in future releases:

- Customizable Splash screen
- Plugins

> [!WARNING]
> This package is still in development and the API will change and evolve very quickly.

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
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";

const canvas = document.querySelector("canvas")!;

const runtime = new Runtime(canvas, {
  // Displays a stats.js FPS panel — useful during development
  includePerformanceStats: true
});

// The world gives you access to the engine systems
// (scene, renderer, input, etc.)
const { world } = runtime;

// loadRuntime will detect the GPU, show a loading screen,
// load all registered assets, then start the game loop.
loadRuntime(runtime)
  .catch(console.error);
```

For a more comprehensive illustration, we have created a mini game for [Brackeys 15][brackeys-2026-1]. The official JollyPixel documentation also come with an [Hello World](https://jollypixel.github.io/editor/engine/guides/hello-world.html) guide.

Please refer to the dedicated guides below for additional information specific to your target:

- [Desktop](./docs/platforms/electron.md)
- [Web](./docs/platforms/vite.md)

> [!NOTE]
> The Vite web runtime and the Electron desktop runtime share the exact same HTML file and application code. Only the shell that loads `dist/index.html` differs.

## 📚 API

- [Runtime](./docs/Runtime.md)

### `loadRuntime(runtime: Runtime, options?: LoadRuntimeOptions)`

Bootstraps the runtime by detecting GPU capabilities, displaying a loading screen, loading all registered assets, and starting the game loop.

Returns a `Promise<void>` that resolves when loading completes, or shows an error on the loading screen if something fails.

```ts
interface LoadRuntimeOptions {
  /**
   * @default 850
   * Minimum delay (ms) before starting asset loading. Gives the loading UI time to render.
   */
  loadingDelay?: number;
  /**
   * Whether to automatically focus the game canvas when the user clicks anywhere on the page.
   * This is important for games that require keyboard input,
   * as it ensures that the canvas has focus and can receive keyboard events.
   * @default true
   */
  focusCanvas?: boolean;
}

```

### 🎨 Custom loader and splash screen

🚧 The loading component (splash screen) will be customizable in future releases.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[vite]: https://vite.dev/
[electron]: https://www.electronjs.org/
[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[brackeys-2026-1]: https://github.com/JollyPixel/games/tree/main/games/brackeys-2026-1
