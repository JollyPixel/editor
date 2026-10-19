// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import {
  createAssetWorkspacePlugin,
  createProjectKindsPlugin,
  ProjectFile,
  ProjectKinds
} from "@jolly-pixel/asset-server/node";
import {
  PORTS,
  precompress,
  RunMode
} from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  createPixelArtSeed,
  TEXTURE_SIZE
} from "./page/src/boot/pixelArtProject.ts";

// CONSTANTS
const kTextureAssetId = "texture-default";
const kCatalogMaxContentBytes = 32 * 1024 * 1024;

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

export default defineConfig((env) => {
  const mode = new RunMode(
    env,
    { port: PORTS.pixelArt }
  );

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
    plugins: [
      mode.plugins(),
      precompress(),
      mode.serve && !mode.e2e && checker({ typescript: true }),
      createProjectKindsPlugin(kinds),
      createAssetWorkspacePlugin({
        root: import.meta.dirname,
        inMemory: true,
        ...mode.access,
        handlers: kinds.handlers(),
        seed: createPixelArtSeed(kTextureAssetId),
        launch: () => kTextureAssetId,
        backend: {
          catalogMaxContentBytes: kCatalogMaxContentBytes
        }
      })
    ]
  };
});
