// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import { defineConfig } from "vite";
import { textureAssetKind } from "@jolly-pixel/asset-server";
import {
  createAssetWorkspacePlugin
} from "@jolly-pixel/asset-server/plugins/vite.ts";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import * as EventStore from "@jolly-pixel/event-store";
import {
  PIXEL_ART_KIND,
  pixelArtAssetKind
} from "@jolly-pixel/asset.pixel-art";
import {
  VOXEL_MAP_KIND,
  voxelMapAssetKind
} from "@jolly-pixel/asset.voxel-map";
import { PORTS } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  CHUNK_SIZE,
  encodeTilesetDocument,
  encodeWorldDocument,
  readDefaultTileset
} from "./vite/worldSeed.ts";

// CONSTANTS
const kE2EMode = "e2e";
const kTilesetAssetId = "tileset-default";

const tileset = await readDefaultTileset(kTilesetAssetId);

export default defineConfig(({ mode }) => {
  const e2e = mode === kE2EMode;
  const staticHosting = mode === "static";

  return {
    base: "./",
    server: e2e ?
      {
        port: PORTS.voxelMap,
        strictPort: true
      } :
      {
        allowedHosts: true
      },
    plugins: staticHosting ? [] : [
      createAssetWorkspacePlugin({
        root: path.join(import.meta.dirname, "assets"),
        ...(e2e ?
          {
            source: new MemoryAssetSource(),
            eventStore: EventStore.persistence.memory()
          } :
          {}),
        launch: ({ catalog }) => catalog.byKind(VOXEL_MAP_KIND).next().value?.id.value,
        handlers: [
          pixelArtAssetKind({ defaultSize: tileset.size }),
          voxelMapAssetKind({ chunkSize: CHUNK_SIZE }),
          textureAssetKind()
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
