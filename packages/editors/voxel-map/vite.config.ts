// Import Third-party Dependencies
import { defineConfig } from "vite";
import { createWebSocketNetworkPlugin } from "@jolly-pixel/network/plugins/vite.ts";
import { PixelSyncServer } from "@jolly-pixel/pixel-draw.renderer";
import { VoxelSyncServer, VoxelWorld } from "@jolly-pixel/voxel.renderer";

const world = new VoxelWorld(16);
world.addLayer("Ground");

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    allowedHosts: true
  },
  plugins: [
    createWebSocketNetworkPlugin({
      extensions: [
        new PixelSyncServer({
          id: "voxel-map:texture"
        }),
        new VoxelSyncServer({
          id: "voxel-map:world",
          world
        })
      ]
    })
  ]
});
