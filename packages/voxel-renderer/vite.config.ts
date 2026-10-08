// Import Node.js Dependencies
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";

// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import glsl from "vite-plugin-glsl";
import wasm from "vite-plugin-wasm";

// CONSTANTS
const kExamplesRoot = fileURLToPath(
  new URL("examples", import.meta.url)
);
const kPages = globSync("**/index.html", {
  cwd: kExamplesRoot,
  exclude: (entry) => entry === "dist"
}).map((page) => page.replaceAll("\\", "/"));
const kCrossOriginIsolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp"
};

// https://vitejs.dev/config/
export default defineConfig({
  root: "examples",
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        kPages.map((page) => [
          page.replace(/[/]?index\.html$/, "") || "index",
          fileURLToPath(new URL(`examples/${page}`, import.meta.url))
        ])
      )
    }
  },
  resolve: {
    alias: [
      {
        find: /^@jolly-pixel\/voxel\.renderer$/,
        replacement: fileURLToPath(new URL("src/index.ts", import.meta.url))
      },
      {
        find: /^@jolly-pixel\/voxel\.renderer\/engine$/,
        replacement: fileURLToPath(new URL("src/plugins/engine/index.ts", import.meta.url))
      }
    ]
  },
  server: {
    allowedHosts: true,
    headers: kCrossOriginIsolation
  },
  preview: {
    headers: kCrossOriginIsolation
  },
  worker: {
    format: "es"
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
