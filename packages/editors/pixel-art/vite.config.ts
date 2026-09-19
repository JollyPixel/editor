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
  PIXEL_ART_KIND,
  pixelArtAssetKind
} from "@jolly-pixel/asset.pixel-art";

// Import Internal Dependencies
import {
  DEMO_ASSET_ID,
  DEMO_ASSET_PATH,
  TEXTURE_SIZE
} from "./examples/scripts/config.ts";
import {
  WORKER_COUNT,
  testAssetId,
  testAssetPath
} from "./test/e2e/constants.ts";

// CONSTANTS
const kCatalogMaxContentBytes = 32 * 1024 * 1024;
const kCanvasSeeds = [
  [DEMO_ASSET_PATH, DEMO_ASSET_ID],
  ...Array.from(
    { length: WORKER_COUNT },
    (_, index) => [testAssetPath(index), testAssetId(index)]
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
        pixelArtAssetKind({
          defaultSize: TEXTURE_SIZE
        })
      ],
      seed: Object.fromEntries(
        kCanvasSeeds.map(([assetPath, id]) => [
          assetPath,
          {
            id,
            kind: PIXEL_ART_KIND,
            content: blankCanvas
          }
        ])
      ),
      launch: () => DEMO_ASSET_ID,
      backend: {
        catalogMaxContentBytes: kCatalogMaxContentBytes
      }
    })
  ]
});
