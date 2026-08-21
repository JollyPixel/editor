// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import { defineConfig } from "vite";
import { textureAssetHandler } from "@jolly-pixel/asset-server";
import {
  createAssetWorkspacePlugin
} from "@jolly-pixel/asset-server/plugins/vite.ts";
import { PixelBuffer } from "@jolly-pixel/pixel-draw.renderer";
import {
  encodePixelArtDocument,
  pixelArtAssetHandler
} from "@jolly-pixel/pixel-draw.renderer/asset/index.ts";
import {
  createVoxelMapState,
  encodeVoxelMapDocument,
  voxelMapAssetHandler
} from "@jolly-pixel/voxel.renderer/asset/index.ts";

// CONSTANTS
const kChunkSize = 16;
const kTextureSize = {
  x: 32,
  y: 32
};

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    allowedHosts: true
  },
  plugins: [
    createAssetWorkspacePlugin({
      root: path.join(import.meta.dirname, "assets"),
      handlers: [
        pixelArtAssetHandler({ defaultSize: kTextureSize }),
        voxelMapAssetHandler({ chunkSize: kChunkSize }),
        textureAssetHandler()
      ],
      seed: {
        "textures/block.pixelart": () => encodePixelArtDocument(
          new PixelBuffer({ size: kTextureSize })
        ),
        "maps/overworld.voxelmap.json": () => {
          const state = createVoxelMapState(kChunkSize);
          state.world.addLayer("Ground");

          return encodeVoxelMapDocument(state);
        }
      }
    })
  ]
});
