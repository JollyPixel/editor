// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import { defineConfig } from "vite";
import {
  createAssetWorkspacePlugin
} from "@jolly-pixel/asset-server/node";
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
const kWorkspaceBrowserEntries = [
  "@jolly-pixel/asset",
  "@jolly-pixel/asset-server",
  "@jolly-pixel/asset.pixel-art/client",
  "@jolly-pixel/asset.voxel-map",
  "@jolly-pixel/asset.voxel-map/client",
  "@jolly-pixel/color",
  "@jolly-pixel/console",
  "@jolly-pixel/console/element",
  "@jolly-pixel/editor.host",
  "@jolly-pixel/editor.host/ui",
  "@jolly-pixel/editor.pixel-art",
  "@jolly-pixel/engine",
  "@jolly-pixel/network/client",
  "@jolly-pixel/pixel-draw.renderer",
  "@jolly-pixel/resize-handle",
  "@jolly-pixel/three",
  "@jolly-pixel/ui",
  "@jolly-pixel/ui/network",
  "@jolly-pixel/voxel.renderer",
  "@jolly-pixel/voxel.renderer/engine"
];

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
    optimizeDeps: e2e ?
      {
        include: kWorkspaceBrowserEntries,
        force: true
      } :
      undefined,
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
