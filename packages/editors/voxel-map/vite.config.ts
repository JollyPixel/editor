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
import { VOXEL_MAP_KIND } from "@jolly-pixel/asset.voxel-map";
import {
  PORTS,
  precompress,
  RunMode
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { createDefaultSeed } from "./src/boot/defaultSeed.ts";

// CONSTANTS
const kBlocksetAssetId = "blockset-default";
const kAssetsRoot = path.join(import.meta.dirname, "assets");
const kProjectFile: ProjectFileData = {
  version: 1,
  kinds: {
    "@jolly-pixel/asset.voxel-map": {}
  }
};

export default defineConfig(async(env): Promise<UserConfig> => {
  const mode = new RunMode(
    env,
    { port: PORTS.voxelMap }
  );
  const projectFile = await ProjectFile.open(
    kAssetsRoot,
    kProjectFile,
    mode
  );
  const kinds = await ProjectKinds.load(projectFile);

  return {
    base: "./",
    server: mode.server,
    plugins: [
      mode.plugins(),
      precompress(),
      createProjectKindsPlugin(kinds),
      createProjectFileWatchPlugin(projectFile),
      createAssetWorkspacePlugin({
        root: kAssetsRoot,
        inMemory: mode.inMemory,
        ...mode.access,
        launch({ catalog }) {
          return catalog.byKind(VOXEL_MAP_KIND).next().value?.id.value;
        },
        handlers: kinds.handlers(),
        ...createDefaultSeed(kBlocksetAssetId)
      })
    ]
  };
});
