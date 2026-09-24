// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import { defineConfig } from "vite";
import {
  createAssetWorkspacePlugin
} from "@jolly-pixel/asset-server/plugins/vite.ts";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import * as EventStore from "@jolly-pixel/event-store";
import { VOXEL_MAP_KIND } from "@jolly-pixel/asset.voxel-map";
import { PORTS } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { createWorldProject } from "./src/boot/worldProject.ts";

// CONSTANTS
const kE2EMode = "e2e";
const kTilesetAssetId = "tileset-default";
const kTilesetFile = path.join(
  import.meta.dirname,
  "public",
  "textures",
  "tileset.png"
);

const project = await createWorldProject(
  await fs.readFile(kTilesetFile),
  kTilesetAssetId
);

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
        ...project
      })
    ]
  };
});
