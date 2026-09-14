// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import glsl from "vite-plugin-glsl";
import wasm from "vite-plugin-wasm";

// https://vitejs.dev/config/
export default defineConfig({
  root: "examples",
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
