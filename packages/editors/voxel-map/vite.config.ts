// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import {
  defineConfig,
  type UserConfig
} from "vite";
import {
  createAssetWorkspacePlugin,
  createProjectFileWatchPlugin,
  createProjectKindsPlugin,
  ProjectFile,
  ProjectKinds,
  type ProjectFileData
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
const kAssetsRoot = path.join(import.meta.dirname, "assets");
const kProjectFile: ProjectFileData = {
  version: 1,
  kinds: {
    "@jolly-pixel/asset.voxel-map": {}
  }
};
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

export default defineConfig(async({ command, mode }): Promise<UserConfig> => {
  const e2e = mode === kE2EMode;
  const staticHosting = mode === "static";
  const inMemory = command === "build" || e2e;
  const projectFile = await ProjectFile.open(kAssetsRoot, kProjectFile, {
    inMemory
  });
  const kinds = await ProjectKinds.load(projectFile);

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
    plugins: [
      createProjectKindsPlugin(kinds),
      inMemory ? null : createProjectFileWatchPlugin(projectFile),
      staticHosting ? null : createAssetWorkspacePlugin({
        root: kAssetsRoot,
        ...(e2e ?
          {
            source: new MemoryAssetSource(),
            eventStore: EventStore.persistence.memory()
          } :
          {}),
        launch: ({ catalog }) => catalog.byKind(VOXEL_MAP_KIND).next().value?.id.value,
        handlers: kinds.handlers(),
        ...project
      })
    ]
  };
});
