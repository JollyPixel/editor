// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import * as EventStore from "@jolly-pixel/event-store";
import {
  createAssetWorkspacePlugin,
  createProjectKindsPlugin,
  ProjectFile,
  ProjectKinds
} from "@jolly-pixel/asset-server/node";
import { PORTS } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  createPixelArtSeed,
  TEXTURE_SIZE
} from "./page/scripts/pixelArtProject.ts";

// CONSTANTS
const kE2EMode = "e2e";
const kTextureAssetId = "texture-default";
const kCatalogMaxContentBytes = 32 * 1024 * 1024;
const kWorkspaceBrowserEntries = [
  "@jolly-pixel/asset.pixel-art/client",
  "@jolly-pixel/color",
  "@jolly-pixel/console",
  "@jolly-pixel/console/element",
  "@jolly-pixel/controls",
  "@jolly-pixel/editor.host",
  "@jolly-pixel/engine",
  "@jolly-pixel/image",
  "@jolly-pixel/image/browser",
  "@jolly-pixel/pixel-draw.renderer",
  "@jolly-pixel/runtime",
  "@jolly-pixel/ui",
  "@jolly-pixel/ui/icon",
  "@jolly-pixel/ui/network"
];

const kinds = await ProjectKinds.load(
  new ProjectFile(import.meta.dirname, {
    version: 1,
    kinds: {
      "@jolly-pixel/asset.pixel-art": {
        defaultSize: TEXTURE_SIZE
      }
    }
  })
);

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const e2e = mode === kE2EMode;
  const serve = command === "serve";

  return {
    root: "page",
    base: "./",
    build: {
      outDir: "../dist-page",
      emptyOutDir: true
    },
    server: {
      port: PORTS.pixelArt,
      strictPort: true,
      allowedHosts: true
    },
    optimizeDeps: e2e ?
      {
        include: kWorkspaceBrowserEntries,
        force: true
      } :
      undefined,
    plugins: [
      serve && !e2e ? checker({ typescript: true }) : null,
      createProjectKindsPlugin(kinds),
      serve ?
        createAssetWorkspacePlugin({
          root: import.meta.dirname,
          source: new MemoryAssetSource(),
          eventStore: EventStore.persistence.memory(),
          handlers: kinds.handlers(),
          seed: createPixelArtSeed(kTextureAssetId),
          launch: () => kTextureAssetId,
          backend: {
            catalogMaxContentBytes: kCatalogMaxContentBytes
          }
        }) :
        null
    ]
  };
});
