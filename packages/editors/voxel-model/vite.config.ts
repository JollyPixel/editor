// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import {
  createAssetWorkspacePlugin
} from "@jolly-pixel/asset-server/plugins/vite.ts";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import * as EventStore from "@jolly-pixel/event-store";
import {
  PIXEL_ART_KIND,
  pixelArtAssetKind
} from "@jolly-pixel/asset.pixel-art";
import {
  VOXEL_MODEL_KIND,
  voxelModelAssetKind
} from "@jolly-pixel/asset.voxel-model";

// Import Internal Dependencies
import {
  TEXTURE_SIZE,
  encodeModelDocument,
  encodeTextureDocument
} from "./vite/modelSeed.ts";
import { E2E_PORT } from "./test/e2e/constants.ts";

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
        port: E2E_PORT,
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
        handlers: [
          voxelModelAssetKind(),
          pixelArtAssetKind({ defaultSize: TEXTURE_SIZE })
        ],
        seed: {
          "textures/model.pixelart": {
            id: kTextureAssetId,
            kind: PIXEL_ART_KIND,
            content: () => encodeTextureDocument()
          },
          "models/model.voxelmodel.json": () => encodeModelDocument(
            kTextureAssetId
          )
        },
        launch: ({ catalog }) => catalog.byKind(VOXEL_MODEL_KIND).next().value?.id.value
      })]
    ],
    esbuild: {
      target: "es2024"
    }
  };
});
