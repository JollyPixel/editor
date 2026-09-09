# Web

Vite can serve and build a browser application that uses
`@jolly-pixel/runtime` without runtime-specific plugins.

## Configure Vite

A minimal configuration is enough:

```ts
import { defineConfig } from "vite";

export default defineConfig({});
```

Keep the asset catalog and files that must retain their names in `public/`:

```text
public/
├── assets.json
└── models/
    └── hero.glb
```

Vite serves these files from the application root during development and
copies them unchanged to the build output.

```ts
const runtime = await Runtime.create("canvas", {
  assets: {
    catalog: new URL("assets.json", document.baseURI)
  }
});
```

Use the usual Vite scripts to run and build the application:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

```bash
$ npm run dev
$ npm run build
```

## Optional source plugins

The runtime does not require the following plugins. Add them when the project
imports the corresponding source format:

- [vite-plugin-glsl](https://github.com/UstymUkhman/vite-plugin-glsl#readme)
  imports GLSL and WGSL files.
- [vite-plugin-wasm](https://github.com/Menci/vite-plugin-wasm) supports
  WebAssembly ESM integration and `wasm-pack` output.
- [vite-plugin-checker](https://github.com/fi3ework/vite-plugin-checker) runs
  TypeScript and lint checks alongside the development server.

Frame caps and the optional runtime HUD are covered in
[frame scheduling and performance](../frame-scheduling-and-performance.md).

