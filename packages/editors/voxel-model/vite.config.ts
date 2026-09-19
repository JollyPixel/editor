// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import {
  createAssetWorkspacePlugin
} from "@jolly-pixel/asset-server/plugins/vite.ts";
import {
  encodePixelArtDocument,
  PixelBuffer,
  serializePixelBuffer
} from "@jolly-pixel/pixel-draw.renderer";
import {
  PIXEL_ART_KIND,
  pixelArtAssetHandler
} from "@jolly-pixel/asset.pixel-art";
import {
  VOXEL_MODEL_KIND,
  createVoxelModelDocument,
  encodeVoxelModelDocument,
  voxelModelAssetHandler
} from "@jolly-pixel/asset.voxel-model";

// CONSTANTS
const kTextureSize = { x: 64, y: 64 };
const kTextureAssetId = "model-texture";

export default defineConfig({
  plugins: [
    checker({
      typescript: false
    }),
    createAssetWorkspacePlugin({
      root: path.join(import.meta.dirname, "assets"),
      handlers: [
        voxelModelAssetHandler(),
        pixelArtAssetHandler({ defaultSize: kTextureSize })
      ],
      seed: {
        "textures/model.pixelart": {
          id: kTextureAssetId,
          kind: PIXEL_ART_KIND,
          content: () => encodePixelArtDocument(
            serializePixelBuffer(new PixelBuffer({ size: kTextureSize }))
          )
        },
        "models/model.voxelmodel.json": () => encodeVoxelModelDocument(
          createVoxelModelDocument({
            texture: {
              id: kTextureAssetId,
              kind: PIXEL_ART_KIND
            }
          })
        )
      },
      launch: ({ catalog }) => catalog.byKind(VOXEL_MODEL_KIND).next().value?.id.value
    })
  ],
  esbuild: {
    target: "es2024"
  }
});
