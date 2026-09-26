// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import {
  createAssetWorkspacePlugin
} from "@jolly-pixel/asset-server/node";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import * as EventStore from "@jolly-pixel/event-store";
import { VOXEL_MODEL_KIND } from "@jolly-pixel/asset.voxel-model";
import { PORTS } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { createModelProject } from "./src/boot/modelProject.ts";

// CONSTANTS
const kE2EMode = "e2e";
const kTextureAssetId = "model-texture";

export default defineConfig(({ mode }) => {
  const e2e = mode === kE2EMode;
  const staticHosting = mode === "static";

  return {
    base: "./",
    server: e2e ?
      {
        port: PORTS.voxelModel,
        strictPort: true
      } :
      undefined,
    plugins: [
      checker({
        typescript: false
      }),
      ...staticHosting ? [] : [createAssetWorkspacePlugin({
        root: path.join(import.meta.dirname, "assets"),
        ...(e2e ?
          {
            source: new MemoryAssetSource(),
            eventStore: EventStore.persistence.memory()
          } :
          {}),
        ...createModelProject(kTextureAssetId),
        launch: ({ catalog }) => catalog.byKind(VOXEL_MODEL_KIND).next().value?.id.value
      })]
    ],
    esbuild: {
      target: "es2024"
    }
  };
});
