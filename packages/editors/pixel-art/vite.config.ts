// Import Third-party Dependencies
import { defineConfig } from "vite";
import {
  createWebSocketNetworkPlugin
} from "@jolly-pixel/network/plugins/vite.ts";

import checker from "vite-plugin-checker";

import { PixelBuffer } from "@jolly-pixel/pixel-draw.renderer";
import { PixelSyncServer } from "@jolly-pixel/pixel-draw.renderer/network/index.ts";

// Import Internal Dependencies
import {
  WORKER_COUNT,
  testRoomId
} from "./test/e2e/constants.ts";

// CONSTANTS
const kTextureSize = {
  x: 80,
  y: 80
};

function pixelSyncServer(
  id: string
): PixelSyncServer {
  return new PixelSyncServer({
    id,
    buffer: new PixelBuffer({
      size: kTextureSize
    })
  });
}

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
        // Must match examples/scripts/demo/DemoSync.ts's default room.
        pixelSyncServer("pixel-draw:demo-canvas"),
        // One isolated room per Playwright worker (see test/e2e/constants.ts)
        // so e2e tests can run in parallel instead of sharing one buffer.
        ...Array.from(
          { length: WORKER_COUNT },
          (_, index) => pixelSyncServer(testRoomId(index))
        )
      ]
    })
  ]
});
