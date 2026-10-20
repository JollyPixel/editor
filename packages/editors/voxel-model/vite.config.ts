// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import {
  defineConfig,
  type UserConfig
} from "vite";
import {
  createAssetServerPlugin,
  createProjectFileWatchPlugin,
  createProjectKindsPlugin,
  ProjectFile,
  ProjectKinds,
  type ProjectFileData
} from "@jolly-pixel/asset-server/node";
import { VOXEL_MODEL_KIND } from "@jolly-pixel/asset.voxel-model";
import {
  PORTS,
  RunMode
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  createModelProject,
  TEXTURE_SIZE
} from "./src/boot/modelProject.ts";

// CONSTANTS
const kTextureAssetId = "model-texture";
const kAssetsRoot = path.join(import.meta.dirname, "assets");
const kProjectFile: ProjectFileData = {
  version: 1,
  kinds: {
    "@jolly-pixel/asset.voxel-model": {},
    "@jolly-pixel/asset.voxel-animation": {},
    "@jolly-pixel/asset.pixel-art": {
      defaultSize: TEXTURE_SIZE
    }
  }
};

export default defineConfig(async(env): Promise<UserConfig> => {
  const mode = new RunMode(
    env,
    { port: PORTS.voxelModel }
  );
  const projectFile = await ProjectFile.open(
    kAssetsRoot,
    kProjectFile,
    mode.assetServer
  );
  const kinds = await ProjectKinds.load(projectFile);

  return {
    base: "./",
    server: mode.server,
    plugins: [
      mode.plugins(),
      createProjectKindsPlugin(kinds),
      createProjectFileWatchPlugin(projectFile),
      createAssetServerPlugin({
        root: kAssetsRoot,
        ...mode.assetServer,
        ...createModelProject(kTextureAssetId),
        handlers: kinds.handlers(),
        launch({ catalog }) {
          return catalog.byKind(
            VOXEL_MODEL_KIND
          ).next().value?.id.value;
        }
      })
    ]
  };
});
