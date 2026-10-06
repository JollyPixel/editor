// Import Node.js Dependencies
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
import {
  PORTS,
  prebundleWorkspace
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { createDefaultSeed } from "./src/boot/defaultSeed.ts";

// CONSTANTS
const kE2EMode = "e2e";
const kBlocksetAssetId = "blockset-default";
const kAssetsRoot = path.join(import.meta.dirname, "assets");
const kProjectFile: ProjectFileData = {
  version: 1,
  kinds: {
    "@jolly-pixel/asset.voxel-map": {}
  }
};

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
    plugins: [
      prebundleWorkspace(),
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
        ...createDefaultSeed(kBlocksetAssetId)
      })
    ]
  };
});
