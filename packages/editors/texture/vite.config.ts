// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import {
  defineConfig,
  type UserConfig
} from "vite";
import { TEXTURE_KIND } from "@jolly-pixel/asset-server";
import {
  createAssetServerPlugin,
  createProjectFileWatchPlugin,
  createProjectKindsPlugin,
  ProjectFile,
  ProjectKinds,
  type ProjectFileData
} from "@jolly-pixel/asset-server/node";
import {
  PORTS,
  RunMode
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { createTextureProject } from "./src/seed/textureProject.ts";

// CONSTANTS
const kAssetsRoot = path.join(import.meta.dirname, "assets");
const kProjectFile: ProjectFileData = {
  version: 1,
  kinds: {}
};

export default defineConfig(async(env): Promise<UserConfig> => {
  const mode = new RunMode(
    env,
    { port: PORTS.texture }
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
        ...createTextureProject(),
        handlers: kinds.handlers(),
        launch({ catalog }) {
          return catalog.byKind(
            TEXTURE_KIND
          ).next().value?.id.value;
        }
      })
    ]
  };
});
