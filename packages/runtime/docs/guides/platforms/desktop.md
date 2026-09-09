# Desktop

An Electron renderer can run the same HTML and application module as the web
build. The Electron main process loads the output produced by Vite.

## Configure the Vite build

Use a relative base so generated script, stylesheet, and asset URLs resolve
from the built `index.html`:

```ts
import { defineConfig } from "vite";

export default defineConfig({
  base: "./"
});
```

Application code should also resolve the asset catalog from the document:

```ts
const runtime = await Runtime.create("canvas", {
  assets: {
    catalog: new URL("assets.json", document.baseURI)
  }
});
```

## Create the Electron main process

Create `electron/main.js`:

```js
import { fileURLToPath } from "node:url";
import path from "node:path";

import { app, BrowserWindow } from "electron";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

function createWindow() {
  const window = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  void window.loadFile(
    path.join(currentDirectory, "../dist/index.html")
  );
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
```

The runtime does not need Node.js integration or a preload script. If the game
needs desktop-only capabilities, expose named operations through a preload
script instead of forwarding arbitrary IPC channels. Electron's
[context isolation guide](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
shows that pattern.

## Add the package scripts

Point the application entry at the Electron main process:

```json
{
  "main": "electron/main.js",
  "scripts": {
    "build": "vite build",
    "start": "npm run build && electron ."
  }
}
```

```bash
$ npm start
```

`loadFile()` is enough for a small local wrapper. Electron recommends a
restricted [custom protocol](https://www.electronjs.org/docs/latest/api/protocol)
for packaged applications because it can limit which local files the renderer
may request.

