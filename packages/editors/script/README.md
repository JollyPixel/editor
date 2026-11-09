## 📌 About

Private editor workspace for `@jolly-pixel/asset.script` scripts, shaders and text files, booted through `@jolly-pixel/editor.host`.

- The code view is a transparent `<textarea>` over the highlighted lines. Highlighting uses Shiki's raw JavaScript engine with the precompiled grammar of the file extension (TypeScript, JavaScript, JSON, YAML, TOML, XML, HTML, CSS or Markdown), loaded on demand. A `.txt` file is not highlighted. Each line keeps its tokenizer state, so an edit retokenizes from its line until the state matches again. Only the visible lines render.
- Peers see each other's carets and selections. Tab and Shift+Tab indent, Enter keeps the indentation, and Ctrl+Z / Ctrl+Y undo and redo local edits only.
- A Markdown file opens next to a rendered preview, updated 150 ms after the last edit. A member who cannot edit sees the preview only.
- A shader (`.tsl.ts`) opens next to a WebGPU preview, rebuilt 300 ms after the last edit. Under it, Fragment and Vertex tabs show the WGSL three.js generates (`renderer.debug.getShaderAsync`), or the error with its line and column. A broken edit keeps the last working material on screen. The preview mesh can be a sphere, box, plane, torus, cylinder or capsule.

### Shader modules

A shader is a TypeScript module whose default export returns a node material. It may import only `three`, `three/webgpu` and `three/tsl`, which resolve to the editor's own three.js; any other import, and any dynamic import, is refused.

```ts
import { color, mix, sin, time, uv } from "three/tsl";
import { Color, MeshStandardNodeMaterial, Texture } from "three/webgpu";

export const uniforms = {
  tint: new Color("#2f6fd6"),
  speed: 1,
  map: new Texture()
};

export default function material({ tint, speed, map }) {
  const material = new MeshStandardNodeMaterial();
  const wave = sin(time.mul(speed).add(uv().x.mul(6))).mul(0.5).add(0.5);
  material.colorNode = mix(tint, color("#d9822b"), wave).mul(map);

  return material;
}
```

The optional `uniforms` export declares the values a scene component can set, with their defaults: a number, `Color`, `Vector2`, `Vector3`, `Vector4` or `Texture`. Any other value is refused. Each material gets its own nodes: `uniform(value)` for a value and `texture(value)` for a texture, built from the component's value or the default. The preview always uses the defaults; an empty `Texture` samples black.

`compileShader(source, name)` strips the types with SWC in strip-only mode ([`@swc/wasm-typescript-esm`](https://www.npmjs.com/package/@swc/wasm-typescript-esm), the engine behind Node's own type stripping), so positions are kept. [es-module-lexer](https://github.com/guybedford/es-module-lexer) points each import at a `data:` module that re-exports the editor's three.js, and the result is imported from a `data:` URL named after the asset path with `//# sourceURL`. A thrown error therefore reports the line of the asset. Under Node, the `#stripper` import resolves to `node:module`'s `stripTypeScriptTypes` instead, so the unit tests run the same path without the wasm. The code runs in the page with the rights of the viewer, as a game would: any member who can edit a shader runs code in the tab of everyone who opens it.

The package also contributes the scene `Script` component (`jollypixel.scene`, export `./scene`). Its script slot takes a script asset; the inspector then offers that script's behaviors and lists the picked behavior's properties with their types and defaults. It also opens shader assets for the optional `shader` slot of the built-in `Mesh` and of the `Model` component, whose inspector then lists the shader's uniforms (texture uniforms pick a `texture` asset). A uniform edit updates a `Mesh` material in place and rebuilds a `Model`. The scene recompiles a shader 300 ms after its last edit and rebuilds with the new material, and a broken version keeps the last working one. The compiler loads on the first shader the scene uses. The standalone scene editor loads no component package, so try it through the studio.

Its runtime entry (`jollypixel.runtime`, export `./runtime`) runs scripts and shaders in a game. The `Script` component there is the engine's `ScriptDefinition`, which takes the behavior from the exports of the script in its slot. A game loads the build of each asset, already JavaScript (see `@jolly-pixel/asset.script`), and links it the way the shader editor does: `three`, `three/webgpu`, `three/tsl` and `@jolly-pixel/engine` become `data:` modules over the game's own copies, so a script extends the same `Behavior` class the game runs. A relative import names another script by its path, resolved against the importing script's path; `.js` and a missing extension both find the `.ts` file. The imported script is linked first, and every script that imports it links the same `data:` URL, so it is evaluated once. Both sides take the allowed imports from `asset.script`'s `SCRIPT_IMPORTS` and `SHADER_IMPORTS`; `ModuleRegistry` refuses any other bare specifier with the policy's message. Two scripts that import each other are refused with both paths in the error; an `import type` breaks the cycle, because the build drops it.

## 🚀 Running the editor

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/editor.script dev
```

The dev server seeds `scripts/PlayerBehavior.ts` and `shaders/Wave.tsl.ts` under `assets/`; delete that directory to seed it again.

`window.scriptEditor.document` exposes the script document from the console.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/editor.script test
$ pnpm --filter @jolly-pixel/editor.script test:e2e
$ pnpm --filter @jolly-pixel/editor.script lint
```

The Playwright suite types into two pages at once, which no DOM mock can reproduce.

## License

MIT
