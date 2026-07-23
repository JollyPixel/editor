// Import Third-party Dependencies
import { defineConfig } from "vite";
import {
  createWebSocketNetworkPlugin
} from "@jolly-pixel/network/plugins/vite.ts";

import checker from "vite-plugin-checker";

// Import Internal Dependencies
import { PixelSyncServer } from "./src/network/index.ts";
import { PixelBuffer } from "./src/buffer/PixelBuffer.ts";

// Must match the client's namespace in examples/scripts/main.ts.
const DEMO_NAMESPACE = "pixel-draw:demo-canvas";

// https://vitejs.dev/config/
export default defineConfig({
  root: "examples",
  server: {
    allowedHosts: true
  },
  plugins: [
    checker({
      typescript: true
    }),
    createWebSocketNetworkPlugin({
      // Static for now: one PixelSyncServer instance per buffer, each under
      // its own namespace. A second buffer would be another instance here,
      // e.g. `new PixelSyncServer({ namespace: "pixel-draw:tileset-2", ... })`.
      plugins: [
        new PixelSyncServer({
          namespace: DEMO_NAMESPACE,
          buffer: new PixelBuffer({ size: { x: 80, y: 80 } })
        })
      ]
    })
  ]
});
