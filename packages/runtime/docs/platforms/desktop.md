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
