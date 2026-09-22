// Import Third-party Dependencies
import { defineConfig } from "vite";
import { textureAssetKind } from "@jolly-pixel/asset-server";
import {
  createAssetWorkspacePlugin
} from "@jolly-pixel/asset-server/plugins/vite.ts";
import { pixelArtAssetKind } from "@jolly-pixel/asset.pixel-art";
import { voxelMapAssetKind } from "@jolly-pixel/asset.voxel-map";
import { voxelModelAssetKind } from "@jolly-pixel/asset.voxel-model";

// Import Internal Dependencies
import {
  editorPagesPlugin,
  type EditorPage
} from "./vite/editorPages.ts";
import { resolveProjectRoot } from "./vite/projectRoot.ts";
import {
  CHUNK_SIZE,
  createStudioSeed
} from "./vite/seed/index.ts";

// CONSTANTS
const kEditorPages: EditorPage[] = [
  {
    name: "voxel-map",
    package: "@jolly-pixel/editor.voxel-map"
  },
  {
    name: "voxel-model",
    package: "@jolly-pixel/editor.voxel-model"
  }
];

const seed = await createStudioSeed();

export default defineConfig({
  plugins: [
    editorPagesPlugin({
      pages: kEditorPages
    }),
    createAssetWorkspacePlugin({
      root: resolveProjectRoot(import.meta.dirname),
      handlers: [
        pixelArtAssetKind({ defaultSize: seed.tilesetSize }),
        voxelMapAssetKind({ chunkSize: CHUNK_SIZE }),
        voxelModelAssetKind(),
        textureAssetKind()
      ],
      seed: seed.assets
    })
  ]
});
