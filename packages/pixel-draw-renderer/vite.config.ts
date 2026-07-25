// Import Third-party Dependencies
import { defineConfig } from "vite";
import {
  createWebSocketNetworkPlugin
} from "@jolly-pixel/network/plugins/vite.ts";

import checker from "vite-plugin-checker";

// Import Internal Dependencies
import {
  PixelBuffer,
  PixelSyncServer
} from "./src/index.ts";

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
      roomAuthorities: [
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
