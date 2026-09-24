// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import * as EventStore from "@jolly-pixel/event-store";
import {
  createAssetWorkspacePlugin
} from "@jolly-pixel/asset-server/plugins/vite.ts";
import {
  PIXEL_ART_KIND,
  pixelArtAssetKind
} from "@jolly-pixel/asset.pixel-art";
import { PORTS } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  DEMO_ASSET_ID,
  DEMO_ASSET_PATH,
  TEXTURE_SIZE
} from "./examples/scripts/config.ts";

// CONSTANTS
const kCatalogMaxContentBytes = 32 * 1024 * 1024;

// https://vitejs.dev/config/
export default defineConfig({
  root: "examples",
  server: {
    port: PORTS.pixelArt,
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
      seed: {
        [DEMO_ASSET_PATH]: {
          id: DEMO_ASSET_ID,
          kind: PIXEL_ART_KIND
        }
      },
      launch: () => DEMO_ASSET_ID,
      backend: {
        catalogMaxContentBytes: kCatalogMaxContentBytes
      }
    })
  ]
});
