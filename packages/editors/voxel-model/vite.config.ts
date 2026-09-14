// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import { createWebSocketNetworkPlugin } from "@jolly-pixel/network/plugins/vite.ts";
import { PixelBuffer } from "@jolly-pixel/pixel-draw.renderer";
import { PixelSyncServer } from "@jolly-pixel/pixel-draw.renderer/network/server.ts";

// Import Internal Dependencies
import { ModelSyncServer } from "./src/network/ModelSyncServer.ts";

// CONSTANTS
const kModelRoomName = "voxel-model";
const kTextureRoomName = "voxel-model:texture";
// Must match `kTextureSize` in src/app/LeftPanel.ts -- the join snapshot
// replaces a client's canvas size wholesale with whatever the server has.
const kTextureSize = { x: 64, y: 64 };

export default defineConfig({
  plugins: [
    checker({
      // Enable TypeScript type checking
      typescript: false
    }),
    createWebSocketNetworkPlugin({
      extensions: [
        new ModelSyncServer({ id: kModelRoomName }),
        new PixelSyncServer({
          id: kTextureRoomName,
          buffer: new PixelBuffer({ size: kTextureSize })
        })
      ]
    })
  ],
  esbuild: {
    target: "es2024"
  }
});
