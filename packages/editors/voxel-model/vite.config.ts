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
import { VOXEL_MODEL_KIND } from "@jolly-pixel/asset.voxel-model";
import {
  PORTS,
  prebundleWorkspace
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  createModelProject,
  TEXTURE_SIZE
} from "./src/boot/modelProject.ts";

// CONSTANTS
const kE2EMode = "e2e";
const kTextureAssetId = "model-texture";
const kAssetsRoot = path.join(import.meta.dirname, "assets");
const kProjectFile: ProjectFileData = {
  version: 1,
  kinds: {
    "@jolly-pixel/asset.voxel-model": {},
    "@jolly-pixel/asset.pixel-art": {
      defaultSize: TEXTURE_SIZE
    }
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
        port: PORTS.voxelModel,
        strictPort: true
      } :
      undefined,
    plugins: [
      prebundleWorkspace(),
      createProjectKindsPlugin(kinds),
      inMemory ? null : createProjectFileWatchPlugin(projectFile),
      ...staticHosting ? [] : [createAssetWorkspacePlugin({
        root: kAssetsRoot,
        ...(e2e ?
          {
            source: new MemoryAssetSource(),
            eventStore: EventStore.persistence.memory()
          } :
          {}),
        ...createModelProject(kTextureAssetId),
        handlers: kinds.handlers(),
        launch: ({ catalog }) => catalog.byKind(VOXEL_MODEL_KIND).next().value?.id.value
      })]
    ]
  };
});
