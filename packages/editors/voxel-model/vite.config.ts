// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import {
  defineConfig,
  type UserConfig
} from "vite";
import checker from "vite-plugin-checker";
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
import { PORTS } from "@jolly-pixel/e2e";

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
const kWorkspaceBrowserEntries = [
  "@jolly-pixel/asset.pixel-art",
  "@jolly-pixel/asset.pixel-art/client",
  "@jolly-pixel/asset.voxel-model",
  "@jolly-pixel/asset.voxel-model/client",
  "@jolly-pixel/editor.host",
  "@jolly-pixel/editor.host/ui",
  "@jolly-pixel/editor.pixel-art",
  "@jolly-pixel/editor.pixel-art/mesh-texturing",
  "@jolly-pixel/engine",
  "@jolly-pixel/network/client",
  "@jolly-pixel/pixel-draw.renderer",
  "@jolly-pixel/three",
  "@jolly-pixel/ui",
  "@jolly-pixel/ui/icon",
  "@jolly-pixel/ui/network"
];

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
    optimizeDeps: e2e ?
      {
        include: kWorkspaceBrowserEntries,
        force: true
      } :
      undefined,
    plugins: [
      checker({
        typescript: false
      }),
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
    ],
    esbuild: {
      target: "es2024"
    }
  };
});
