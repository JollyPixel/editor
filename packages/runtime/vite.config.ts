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
        find: /^@jolly-pixel\/runtime$/,
        replacement: fileURLToPath(new URL("src/index.ts", import.meta.url))
      }
    ]
  },
  plugins: [
    checker({
      typescript: true
    }),
    glsl(),
    wasm()
  ],
  /*
   * @dimforge/rapier3d uses a static `import ... from "*.wasm"` that Vite's
   * pre-bundler (esbuild) cannot handle. Excluding it forces Vite to serve
   * the package as-is, letting the browser load the WASM binary directly.
   */
  optimizeDeps: {
    exclude: ["@dimforge/rapier3d"]
  }
});

