// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import { defineConfig } from "vite";
import { textureAssetHandler } from "@jolly-pixel/asset-server";
import {
  createAssetWorkspacePlugin
} from "@jolly-pixel/asset-server/plugins/vite.ts";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import * as EventStore from "@jolly-pixel/event-store";
import {
  PIXEL_ART_KIND,
  pixelArtAssetHandler
} from "@jolly-pixel/asset.pixel-art";
import { voxelMapAssetHandler } from "@jolly-pixel/asset.voxel-map";

// Import Internal Dependencies
import {
  CHUNK_SIZE,
  encodeTilesetDocument,
  encodeWorldDocument,
  readDefaultTileset
} from "./vite/worldSeed.ts";
import { E2E_PORT } from "./test/e2e/constants.ts";

// CONSTANTS
const kE2EMode = "e2e";
const kTilesetAssetId = "tileset-default";

const tileset = await readDefaultTileset(kTilesetAssetId);

export default defineConfig(({ mode }) => {
  const e2e = mode === kE2EMode;

  return {
    server: e2e ?
      {
        port: E2E_PORT,
        strictPort: true
      } :
      {
        allowedHosts: true
      },
    plugins: [
      createAssetWorkspacePlugin({
        root: path.join(import.meta.dirname, "assets"),
        ...(e2e ?
          {
            source: new MemoryAssetSource(),
            eventStore: EventStore.persistence.memory()
          } :
          {}),
        handlers: [
          pixelArtAssetHandler({ defaultSize: tileset.size }),
          voxelMapAssetHandler({ chunkSize: CHUNK_SIZE }),
          textureAssetHandler()
        ],
        seed: {
          "textures/block.pixelart": {
            id: kTilesetAssetId,
            kind: PIXEL_ART_KIND,
            content: () => encodeTilesetDocument(tileset)
          },
          "maps/overworld.voxelmap.json": () => encodeWorldDocument(
            tileset.definition
          )
        }
      })
    ]
  };
});
