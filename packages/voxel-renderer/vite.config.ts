// Import Third-party Dependencies
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import glsl from "vite-plugin-glsl";
import wasm from "vite-plugin-wasm";

// https://vitejs.dev/config/
export default defineConfig({
  root: "examples",
  plugins: [
    checker({
      typescript: true
    }),
    glsl(),
    wasm()
  ],
  // @dimforge/rapier3d uses a static `import ... from "*.wasm"` that Vite's
  // pre-bundler (esbuild) cannot handle. Excluding it forces Vite to serve
  // the package as-is, letting the browser load the WASM binary directly.
  optimizeDeps: {
    exclude: ["@dimforge/rapier3d"]
  }
});

