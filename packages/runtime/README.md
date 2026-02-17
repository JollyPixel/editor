<p align="center"><h1 align="center">
  runtime
</h1>

<p align="center">
  JollyPixel Three.js runtime
</p>

## 💡 Features

- Web runtime with [Vite](https://vite.dev/)
- Desktop runtime with [Electron.js](https://www.electronjs.org/)

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm](https://docs.npmjs.com/getting-started/what-is-npm) or [yarn](https://yarnpkg.com).

```bash
$ npm i @jolly-pixel/runtime
# or
$ yarn add @jolly-pixel/runtime
```

## 👀 Usage example

The runtime needs a `<canvas>` element to render into. Start by creating an HTML file with a canvas and a module script entry point:

```html
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Game</title>
  <link rel="stylesheet" href="./main.css">
</head>

<canvas tabindex="-1"></canvas>

<script type="module" src="./src/main.ts"></script>

</html>
```

> [!TIP]
> The `tabindex="-1"` attribute on the canvas allows it to receive keyboard focus, which is required for capturing input events.

Then in your main script, create a `Runtime` instance and call `loadRuntime` to bootstrap everything (GPU detection, asset loading screen, game loop startup):

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

### Electron.js support

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

### Custom loader component

In future releases, the loading component will be customizable.

## License

MIT
