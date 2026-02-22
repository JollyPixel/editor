# README.md

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
export interface LoadRuntimeOptions {
  /**
   * @default 850
   * Minimum delay (ms) before starting asset loading. Gives the loading UI time to render.
   */
  loadingDelay?: number;
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


# ARCHITECTURE.md

# Architecture

This document describes how the `@jolly-pixel/runtime` package is structured
and how its components interact during the lifecycle of a game session.

## Project structure

```
src/
├── index.ts               Entry point — exports Runtime and loadRuntime
├── Runtime.ts             Core runtime class (game loop, renderer, clock)
├── components/
│   └── Loading.ts         <jolly-loading> Lit web component
└── utils/
    ├── getDevicePixelRatio.ts   Pixel-ratio helper (mobile vs desktop)
    └── timers.ts                Promise-based setTimeout wrapper
```

## High-level overview

The runtime sits between the **host environment** (browser or Electron)
and the **engine** (`@jolly-pixel/engine`). It is responsible for:

1. Creating a Three.js renderer bound to a `<canvas>`
2. Detecting GPU capabilities and adapting quality
3. Displaying a loading screen while assets are fetched
4. Running the update/render loop at a target frame rate

```
┌─────────────────────────────────────────────────┐
│                 Host environment                │
│            (Browser / Electron shell)           │
└────────────────────┬────────────────────────────┘
                     │  provides <canvas>
                     ▼
┌─────────────────────────────────────────────────┐
│                   loadRuntime()                 │
│  ┌───────────┐  ┌────────────┐  ┌────────────┐  │
│  │  detect-  │  │  <jolly-   │  │   Assets   │  │
│  │    gpu    │  │  loading>  │  │   loader   │  │
│  └─────┬─────┘  └─────┬──────┘  └──────┬─────┘  │
│        │              │                │        │
│        ▼              ▼                ▼        │
│  ┌──────────────────────────────────────────┐   │
│  │                Runtime                   │   │
│  │  ┌────────────────────────────────────┐  │   │
│  │  │          World              │  │   │
│  │  │  (SceneEngine + ThreeRenderer)     │  │   │
│  │  └────────────────────────────────────┘  │   │
│  │  THREE.Clock ─── tick() ─── stats.js     │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## Bootstrap sequence

`loadRuntime()` orchestrates the full startup. Below is the ordered
sequence of operations:

```
loadRuntime(runtime)
 │
 ├─ 1. Start GPU detection ─────────────── getGPUTier()  (async, runs in parallel)
 │
 ├─ 2. Hide canvas ─────────────────────── opacity: 0
 │
 ├─ 3. Mount <jolly-loading> ───────────── Lit web component
 │     └─ start()                          begins fade-in animation
 │
 ├─ 4. Wait loadingDelay ───────────────── default 850 ms
 │
 ├─ 5. Await GPU tier result
 │     ├─ setFps(fps)                      clamp 1–60
 │     ├─ setPixelRatio(ratio)             mobile vs desktop cap
 │     └─ tier < 1 → throw                 GPU too weak
 │
 ├─ 6. Load assets ─────────────────────── Systems.Assets.loadAssets()
 │     └─ onProgress → loading bar         tracks loaded / total
 │
 ├─ 7. Complete loading screen
 │     ├─ progress bar fills ──────────── 400 ms animation
 │     ├─ fade-out ────────────────────── 500 ms
 │     └─ remove <jolly-loading>
 │
 └─ 8. Start runtime ──────────────────── runtime.start()
       ├─ canvas opacity: 1               fade-in with CSS transition
       ├─ world.connect()
       └─ setAnimationLoop(tick)           game loop begins
```

> On any error during steps 5–8, the loading screen displays the error
> message and stack trace instead.

## Game loop

The `Runtime.tick` callback is called by Three.js via `setAnimationLoop`.
It implements a **fixed-timestep** pattern capped at the target FPS:

```
setAnimationLoop(tick)
 │
 └─ tick()
     │
     ├─ world.beginFrame()           ← snapshot tree + start components (once)
     │
     ├─ fixedTimeStep.tick({fixedUpdate, update})
     │   │
     │   ├─ fixedUpdate(fixedDelta)  ← runs 0..N times per frame
     │   │   └─ world.fixedUpdate(dt)
     │   │
     │   └─ update(interpolation, delta) ← runs once per frame
     │       ├─ stats.begin()
     │       ├─ world.update(dt)
     │       ├─ world.render()
     │       └─ stats.end()
     │
     └─ world.endFrame()             ← destroy pending (once)
         └─ returns true → runtime.stop()
```

The loop stops when:
- `world.endFrame()` signals an exit (input system exited)
- `runtime.stop()` is called manually

## Loading screen

The `<jolly-loading>` element is a [Lit](https://lit.dev/) web component
registered as a custom element. It manages three visual states:

```
  ┌────────────┐      setProgress()       ┌────────────┐
  │  Loading   │ ─────────────────────▶  │  Progress  │
  │  (started) │      setAsset()          │    bar     │
  └────────────┘                          └─────┬──────┘
                                                │
                                          complete()
                                                │
                                                ▼
                                          ┌────────────┐
                                          │  Fade-out  │
                                          │  + remove  │
                                          └────────────┘

                 error()
  ┌────────────┐ ─────────────────────▶  ┌────────────┐
  │  any state │                         │   Error    │
  └────────────┘                         │  message   │
                                         └────────────┘
```

The progress bar features a shimmer animation and a velocity-based
"speed blur" effect when assets load quickly.

## Pixel-ratio strategy

The runtime caps the device pixel ratio to avoid performance issues on
high-DPI screens:

| Device  | Max pixel ratio |
| ------- | --------------- |
| Desktop | 1               |
| Mobile  | 1.5             |

The actual ratio used is `Math.min(cap, window.devicePixelRatio)`.
Mobile detection comes from the `detect-gpu` library.


# desktop.md

# Desktop

## Electron.js

The runtime also works inside an [Electron](https://www.electronjs.org/) application.
Build your project with Vite first, then load the generated `dist/index.html` from the main process.

Create an `electron/main.js` file to set up the `BrowserWindow`:

```js
import { fileURLToPath } from "node:url";
import path from "node:path";

import { app, BrowserWindow } from "electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  win.loadFile(
    path.join(__dirname, "../dist/index.html")
  );
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
```

Then add a `preload.js` alongside it to safely expose IPC channels
to the renderer:

```js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, func) => ipcRenderer.on(
    channel, (_, ...args) => func(...args)
  )
});
```

Finally, set the `main` field in your `package.json` to point to the Electron entry and add the relevant scripts:

```json
{
  "main": "electron/main.js",
  "scripts": {
    "start": "npm run build && electron .",
    "build": "vite build"
  }
}
```


# web.md

# Web support

## Vite

Vite is functional out of the box, but if you need to tweak it, here's a simple `vite.config.ts` configuration.

```ts
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import glsl from "vite-plugin-glsl";
import wasm from "vite-plugin-wasm";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    checker({
      typescript: true
    }),
    glsl(),
    wasm()
  ]
});
```

Here is a list of useful plugins combined with Three.js:

- [vite-plugin-checker](https://github.com/fi3ework/vite-plugin-checker): provides checks for TypeScript, ESLint, vue-tsc, and Stylelint
- [vite-plugin-glsl](https://github.com/UstymUkhman/vite-plugin-glsl#readme): import, inline (and minify) GLSL/WGSL shader files
- [vite-plugin-wasm](https://github.com/Menci/vite-plugin-wasm): add WebAssembly ESM integration (aka. Webpack's `asyncWebAssembly`) to Vite and support `wasm-pack` generated modules.

## Troubleshooting performance issue

Early section, to be completed

- [three-perf](https://github.com/TheoTheDev/three-perf)
- Three.js [InspectorNode](https://threejs.org/docs/#InspectorNode) and Devtools


# Runtime.md

# Runtime

Main runtime class. Wraps a Three.js renderer, a game instance, and the
update/render loop. Manages the full lifecycle: construction, starting,
stopping, and frame-rate control.

- **start()**: Connects the game instance and begins the render loop via `setAnimationLoop`.
- **stop()**: Disconnects the game instance and removes the animation loop.
- **setFps(fps)**: Clamps the target FPS between `1` and `60`. No-op if `fps` is falsy.

```ts
interface RuntimeOptions<
  TContext = Systems.WorldDefaultContext
> {
  /**
   * @default false
   * Whether to include performance statistics (eg: FPS, memory usage).
   */
  includePerformanceStats?: boolean;
  /**
   * Optional context object passed to the World.
   */
  context?: TContext;
  /**
   * Optional global audio object passed to the World.
   * If not provided, a default audio context will be created.
   */
  audio?: GlobalAudio;
}

class Runtime<
  TContext = WorldDefaultContext
> {
  world: Systems.World<THREE.WebGLRenderer, TContext>;
  canvas: HTMLCanvasElement;
  stats?: Stats;
  clock: THREE.Clock;
  manager: THREE.LoadingManager;
  framesPerSecond: number;

  get running(): boolean;

  constructor(canvas: HTMLCanvasElement, options?: RuntimeOptions<TContext>);

  start(): void;
  stop(): void;
  setFps(framesPerSecond: number | undefined): void;
}
```

> [!NOTE]
> The constructor throws an `Error` if `canvas` is falsy.

## Usage

```ts
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";

const canvas = document.querySelector("canvas")!;
const runtime = new Runtime(canvas, {
  includePerformanceStats: true
});

const { world } = runtime;
// Work with the world

loadRuntime(runtime)
  .catch(console.error);
```

## Type-safe context

The `TContext` generic lets you pass a typed context object to the
underlying `World`:

```ts
interface MyContext {
  score: number;
  level: string;
}

const runtime = new Runtime<MyContext>(canvas, {
  context: { score: 0, level: "intro" }
});

// runtime.world.context is typed as MyContext
runtime.world.context.score; // number
```


