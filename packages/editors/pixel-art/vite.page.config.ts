// Import Third-party Dependencies
import { defineConfig } from "vite";
import {
  createProjectKindsPlugin,
  ProjectFile,
  ProjectKinds
} from "@jolly-pixel/asset-server/node";

// Import Internal Dependencies
import { TEXTURE_SIZE } from "./page/scripts/pixelArtProject.ts";

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

export default defineConfig({
  root: "page",
  base: "./",
  build: {
    outDir: "../dist-page",
    emptyOutDir: true
  },
  plugins: [
    createProjectKindsPlugin(kinds)
  ]
});
