// Import Third-party Dependencies
import { defineConfig } from "vite";
import {
  createWebSocketNetworkPlugin
} from "@jolly-pixel/network/plugins/vite.ts";

import checker from "vite-plugin-checker";

import {
  PixelBuffer,
  PixelSyncServer
} from "@jolly-pixel/pixel-draw.renderer";

// https://vitejs.dev/config/
export default defineConfig({
  root: "examples",
  server: {
    port: 3000,
    strictPort: true,
    allowedHosts: true
  },
  plugins: [
    checker({
      typescript: true
    }),
    createWebSocketNetworkPlugin({
      extensions: [
        new PixelSyncServer({
          // Must match the client's room id in examples/scripts/main.ts.
          id: "pixel-draw:demo-canvas",
          buffer: new PixelBuffer({
            size: {
              x: 80,
              y: 80
            }
          })
        })
      ]
    })
  ]
});
