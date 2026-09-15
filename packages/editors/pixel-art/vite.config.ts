// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import * as EventStore from "@jolly-pixel/event-store";
import {
  createAssetWorkspacePlugin
} from "@jolly-pixel/asset-server/plugins/vite.ts";
import {
  encodePixelArtDocument,
  PixelBuffer,
  serializePixelBuffer
} from "@jolly-pixel/pixel-draw.renderer";
import {
  pixelArtAssetHandler
} from "@jolly-pixel/asset.pixel-art";

// Import Internal Dependencies
import {
  DEMO_ASSET_PATH,
  TEXTURE_SIZE,
  WORKER_COUNT,
  testAssetPath
} from "./test/e2e/constants.ts";

// CONSTANTS
const kCatalogMaxContentBytes = 32 * 1024 * 1024;
const kCanvasPaths = [
  DEMO_ASSET_PATH,
  ...Array.from(
    { length: WORKER_COUNT },
    (_, index) => testAssetPath(index)
  )
];

function blankCanvas(): Uint8Array {
  return encodePixelArtDocument(
    serializePixelBuffer(
      new PixelBuffer({
        size: TEXTURE_SIZE
      })
    )
  );
}

// https://vitejs.dev/config/
export default defineConfig({
  root: "examples",
  server: {
    port: 3000,
    strictPort: true,
    allowedHosts: true
  },
  plugins: [
    checker({
      typescript: true
    }),
    createAssetWorkspacePlugin({
      root: import.meta.dirname,
      source: new MemoryAssetSource(),
      eventStore: EventStore.persistence.memory(),
      handlers: [
        pixelArtAssetHandler({
          defaultSize: TEXTURE_SIZE
        })
      ],
      seed: Object.fromEntries(
        kCanvasPaths.map((assetPath) => [assetPath, blankCanvas])
      ),
      backend: {
        catalogMaxContentBytes: kCatalogMaxContentBytes
      }
    })
  ]
});
