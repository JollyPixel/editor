# Web support

## Vite

Vite is functional out of the box, but if you need to tweak it, here's a simple `vite.config.ts` configuration.

```ts
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import glsl from "vite-plugin-glsl";
import wasm from "vite-plugin-wasm";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    checker({
      typescript: true
    }),
    glsl(),
    wasm()
  ]
});
```

Here is a list of useful plugins combined with Three.js:

- [vite-plugin-checker](https://github.com/fi3ework/vite-plugin-checker): provides checks for TypeScript, ESLint, vue-tsc, and Stylelint
- [vite-plugin-glsl](https://github.com/UstymUkhman/vite-plugin-glsl#readme): import, inline (and minify) GLSL/WGSL shader files
- [vite-plugin-wasm](https://github.com/Menci/vite-plugin-wasm): add WebAssembly ESM integration (aka. Webpack's `asyncWebAssembly`) to Vite and support `wasm-pack` generated modules.

## Troubleshooting performance issue

Early section, to be completed

- [three-perf](https://github.com/TheoTheDev/three-perf)
- Three.js [InspectorNode](https://threejs.org/docs/#InspectorNode) and Devtools
