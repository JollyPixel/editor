// Import Node.js Dependencies
import { fileURLToPath } from "node:url";

// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import glsl from "vite-plugin-glsl";
import wasm from "vite-plugin-wasm";

// https://vitejs.dev/config/
export default defineConfig({
  root: "examples",
  resolve: {
    alias: [
      {
        find: /^@jolly-pixel\/voxel\.renderer$/,
        replacement: fileURLToPath(new URL("src/index.ts", import.meta.url))
      },
      {
        find: /^@jolly-pixel\/voxel\.renderer\/plugins\/(.*)$/,
        replacement: fileURLToPath(new URL("src/plugins/$1", import.meta.url))
      }
    ]
  },
  server: {
    allowedHosts: true
  },
  plugins: [
    checker({
      typescript: true
    }),
    glsl(),
    wasm()
  ],
  /**
   * Exclude @dimforge/rapier3d from Vite's pre-bundling, so the browser can
   * load the WASM binary directly.
   */
  optimizeDeps: {
    exclude: ["@dimforge/rapier3d"]
  }
});
