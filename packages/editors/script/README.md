## 📌 About

Private editor for `@jolly-pixel/asset.script` scripts, shaders and text files, booted through `@jolly-pixel/editor.host`.

- **Code**: a transparent `<textarea>` over lines highlighted by [sugar-high](https://github.com/huozhi/sugar-high) for the file extension (TypeScript, JavaScript, JSON, YAML, TOML, XML, HTML, CSS, Markdown). `.txt` stays plain. An edit retokenizes the whole file, and only visible lines render. The generated shader code uses the editor's own WGSL syntax.
- **Collaboration**: peers see each other's carets and selections. Tab / Shift+Tab indent, Enter keeps the indentation, Ctrl+Z / Ctrl+Y undo and redo local edits only.
- **Markdown**: a rendered preview beside the code, refreshed 150 ms after the last edit. A member who cannot edit sees the preview only.
- **Shader** (`.tsl.ts`): a WebGPU preview beside the code on a sphere, box, plane, torus, cylinder or capsule, rebuilt 300 ms after the last edit. Fragment and Vertex tabs show the generated WGSL, or the error with its line and column. A broken edit keeps the last working material.

### Shader modules

Shaders compile with `loadShader` from `@jolly-pixel/scripting/three`, as in the game build; that package documents the module format. The preview uses the declared uniform defaults, and an empty `Texture` samples black.

Shader code runs in the viewer's page, as in a game: a member who can edit a shader runs code in the tab of everyone who opens it.

### Scene component

The `./scene` export (`jollypixel.scene`) adds the `Script` component. Its slot takes a script asset, and the inspector lists that script's behaviors, then the chosen behavior's properties with their types and defaults.

It also fills the optional `shader` slot of the built-in `Mesh` and of the `Model` component. The inspector lists the shader's uniforms, and a texture uniform picks a `texture` asset. A uniform edit updates a `Mesh` material in place and rebuilds a `Model`. The scene loads the compiler with its first shader, recompiles 300 ms after the last edit, and keeps the last working material when a version breaks.

The standalone scene editor loads no component package: try it through the studio.

### Runtime

The `./runtime` export (`jollypixel.runtime`) runs scripts and shaders in a game. Its `Script` component is the engine's `ScriptDefinition`, which takes the behavior from the exports of the slotted script. It registers the script and shader loaders of `@jolly-pixel/scripting/three`, which link each build against the game's own three.js and engine.

### Markdown element

The `./markdown` export registers `<jolly-markdown>`, used by the Markdown preview and the studio project README. Set its `markdown` property to render that text as HTML with [marked](https://github.com/markedjs/marked), sanitized by [DOMPurify](https://github.com/cure53/DOMPurify). Links open in a new tab. Setting it again renders only the top-level blocks whose source changed, and keeps the elements of the others, unless raw HTML leaves an element open across blocks.

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
