// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import { defineConfig } from "vite";
import { textureAssetHandler } from "@jolly-pixel/asset-server";
import {
  createAssetWorkspacePlugin
} from "@jolly-pixel/asset-server/plugins/vite.ts";
import {
  encodePixelArtDocument,
  pixelArtAssetHandler
} from "@jolly-pixel/pixel-draw.renderer/asset/index.ts";
import {
  createVoxelMapState,
  encodeVoxelMapDocument,
  voxelMapAssetHandler
} from "@jolly-pixel/voxel.renderer/asset/index.ts";

// Import Internal Dependencies
import { readTilesetSeed } from "./vite/tilesetSeed.ts";

// CONSTANTS
const kChunkSize = 16;
const kDefaultLayerName = "Ground";

// The seeded documents and the browser share one atlas: the voxel-map
// document points at the public URL, the pixel-art document holds its pixels.
const tileset = await readTilesetSeed({
  file: path.join(import.meta.dirname, "public", "textures", "tileset.png"),
  definition: {
    id: "default",
    src: "textures/tileset.png",
    tileSize: 32
  }
});

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    allowedHosts: true
  },
  plugins: [
    createAssetWorkspacePlugin({
      root: path.join(import.meta.dirname, "assets"),
      handlers: [
        pixelArtAssetHandler({ defaultSize: tileset.size }),
        voxelMapAssetHandler({ chunkSize: kChunkSize }),
        textureAssetHandler()
      ],
      seed: {
        "textures/block.pixelart": () => encodePixelArtDocument(
          tileset.buffer
        ),
        "maps/overworld.voxelmap.json": () => {
          const state = createVoxelMapState(kChunkSize);
          state.tilesets = [tileset.definition];
          state.world.addLayer(kDefaultLayerName);

          return encodeVoxelMapDocument(state);
        }
      }
    })
  ]
});
