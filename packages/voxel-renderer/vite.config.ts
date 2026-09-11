// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import glsl from "vite-plugin-glsl";
import wasm from "vite-plugin-wasm";
import {
  createWebSocketNetworkPlugin
} from "@jolly-pixel/network/plugins/vite.ts";

// Import Internal Dependencies
import { VoxelSyncServer } from "./src/network/VoxelSyncServer.ts";
import { VoxelWorld } from "./src/world/VoxelWorld.ts";
import {
  CHUNK_SIZE,
  FLAT_WORLD_ROOM,
  seedFlatWorld
} from "./examples/scripts/utils/flatWorld.ts";

// CONSTANTS
const kFlatWorld = new VoxelWorld(CHUNK_SIZE);
seedFlatWorld(kFlatWorld);

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
    glsl(),
    wasm(),
    createWebSocketNetworkPlugin({
      extensions: [
        new VoxelSyncServer({
          id: FLAT_WORLD_ROOM,
          world: kFlatWorld
        })
      ]
    })
  ],
  /**
   * Exclude @dimforge/rapier3d from Vite's pre-bundling, so the browser can
   * load the WASM binary directly.
   */
  optimizeDeps: {
    exclude: ["@dimforge/rapier3d"]
  }
});
