// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import {
  defineConfig,
  type UserConfig
} from "vite";
import {
  createAssetServerPlugin,
  createProjectContributionsPlugin,
  createProjectFileWatchPlugin,
  createProjectKindsPlugin,
  ProjectFile,
  ProjectKinds,
  type ProjectFileData
} from "@jolly-pixel/asset-server/node";
import { SCENE_KIND } from "@jolly-pixel/asset.scene";
import {
  PORTS,
  RunMode
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { createSceneProject } from "./src/boot/sceneProject.ts";

// CONSTANTS
const kAssetsRoot = path.join(import.meta.dirname, "assets");
const kComponentPackages = ["@jolly-pixel/editor.voxel-map"];
const kProjectFile: ProjectFileData = {
  version: 1,
  kinds: {
    "@jolly-pixel/asset.scene": {},
    "@jolly-pixel/asset.voxel-map": {},
    "@jolly-pixel/asset.pixel-art": {}
  }
};

export default defineConfig(async(env): Promise<UserConfig> => {
  const mode = new RunMode(
    env,
    { port: PORTS.scene }
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
      createProjectContributionsPlugin(kinds, kComponentPackages),
      createProjectFileWatchPlugin(projectFile),
      createAssetServerPlugin({
        root: kAssetsRoot,
        ...mode.assetServer,
        ...createSceneProject(),
        handlers: kinds.handlers(),
        launch({ catalog }) {
          return catalog.byKind(
            SCENE_KIND
          ).next().value?.id.value;
        }
      })
    ]
  };
});
