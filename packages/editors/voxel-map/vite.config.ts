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
  serializePixelBuffer
} from "@jolly-pixel/pixel-draw.renderer";
import {
  PIXEL_ART_KIND,
  pixelArtAssetHandler
} from "@jolly-pixel/asset.pixel-art";
import {
  voxelMapAssetHandler,
  VoxelMapState
} from "@jolly-pixel/asset.voxel-map";
import {
  blocksFromTileset,
  DEFAULT_TILE_SIZE,
  encodeVoxelDocument
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { readTilesetSeed } from "./vite/tilesetSeed.ts";

// CONSTANTS
const kChunkSize = 16;
const kDefaultLayerName = "Ground";
const kDefaultBlockLimit = 32;
const kTilesetAssetId = "tileset-default";

const tileset = await readTilesetSeed({
  file: path.join(
    import.meta.dirname,
    "public",
    "textures",
    "tileset.png"
  ),
  definition: {
    id: "default",
    src: kTilesetAssetId,
    tileSize: DEFAULT_TILE_SIZE
  }
});

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
        "textures/block.pixelart": {
          id: kTilesetAssetId,
          kind: PIXEL_ART_KIND,
          content: () => encodePixelArtDocument(
            serializePixelBuffer(tileset.buffer)
          )
        },
        "maps/overworld.voxelmap.json": () => {
          const state = new VoxelMapState(kChunkSize);
          state.tilesets.add({
            id: tileset.definition.id,
            src: tileset.definition.src,
            tileSize: tileset.definition.tileSize
          });
          state.blocks.registerMany(
            blocksFromTileset(tileset.definition, {
              limit: kDefaultBlockLimit
            })
          );
          state.world.addLayer(kDefaultLayerName);

          return encodeVoxelDocument(state.toJSON());
        }
      }
    })
  ]
});
