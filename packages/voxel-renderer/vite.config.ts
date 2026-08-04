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
// Authoritative world for the flat-world example, seeded before any client
// connects so the first snapshot already carries the floor.
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
  // @dimforge/rapier3d uses a static `import ... from "*.wasm"` that Vite's
  // pre-bundler (esbuild) cannot handle. Excluding it forces Vite to serve
  // the package as-is, letting the browser load the WASM binary directly.
  optimizeDeps: {
    exclude: ["@dimforge/rapier3d"]
  }
});

