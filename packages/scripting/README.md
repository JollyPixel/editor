Compiles and loads game scripts and TSL shaders

## 💃 Getting Started

This workspace-private package is never published. Add it as a dependency of
an editor or the studio:

```json
{
  "dependencies": {
    "@jolly-pixel/scripting": "workspace:*"
  }
}
```

Consumers load the built `dist/` output, so run
`pnpm --filter @jolly-pixel/scripting build` after a change.

## 💡 About

Turns the text of a script or shader asset into code a game runs.
`@jolly-pixel/asset.script` stores and syncs the text,
`@jolly-pixel/editor.script` edits it, and this package:

- builds it: scripts are transpiled, shaders lose their types;
- checks its imports;
- lints it with oxlint, and type-checks and completes it with the TypeScript
  language service, for the editor;
- outlines the `Behavior` classes of a script for the scene inspector;
- loads the build in a game.

## 👀 Usage example

```ts
import {
  buildScript,
  readScriptOutline
} from "@jolly-pixel/scripting";

const source = `
import { Behavior, SceneProperty } from "@jolly-pixel/ecs";

export class Player extends Behavior {
  @SceneProperty({ type: "number", label: "Speed" })
  speed = 1;
}
`;

const code = await buildScript(source);
const outline = await readScriptOutline(source);
// { behaviors: [{ name: "Player", properties: [{ key: "speed", type: "number", label: "Speed", description: "", default: 1 }] }] }
```

A game loads each build through the asset loaders:

```ts
import {
  ScriptModuleLoader,
  ShaderModuleLoader
} from "@jolly-pixel/scripting/three";

const scripts = new ScriptModuleLoader(manager);
const shaders = new ShaderModuleLoader(manager);
```

## 📚 API

### Root

Runs in Node and in a browser. `lintScript` and `readScriptOutline` need
Node; their browser builds refuse or answer `null`.

```ts
import { buildScript } from "@jolly-pixel/scripting";
```

- [Build](./docs/build.md): `buildScript`, `buildShader` and `SourceError`
- [`ScriptImportPolicy`](./docs/ScriptImportPolicy.md): `SCRIPT_IMPORTS`,
  `SHADER_IMPORTS` and `ScriptImportError`
- [`ScriptModules`](./docs/ScriptModules.md): the script a relative import
  names, and `SCRIPT_KIND`
- [`lintScript`](./docs/lintScript.md): oxlint diagnostics and the
  `ScriptDiagnostic` schema
- [`readScriptOutline`](./docs/readScriptOutline.md): the outline and its
  schemas

### Language

Needs the `typescript` package, about 9 MB: load it in a Web Worker.

```ts
import { ScriptLanguageService } from "@jolly-pixel/scripting/language";
import files from "@jolly-pixel/scripting/types";
```

- [`ScriptLanguageService`](./docs/ScriptLanguageService.md): type errors,
  completions and quick info, and the declaration files of `./types`

### Three

Needs three.js and `@jolly-pixel/backend.three`.

```ts
import { loadShader } from "@jolly-pixel/scripting/three";
```

- [Loaders](./docs/three/loaders.md): `ScriptModuleLoader`,
  `ShaderModuleLoader` and the import map scripts load through
- [`ShaderModule`](./docs/three/ShaderModule.md): the shader module format,
  `loadShader` and materials

## ✨ Contributors guide

The `#linter`, `#outliner` and `#stripper` imports resolve to
`dist/`, so tests need a build first. `src/types/scriptTypes.ts` is left out
of the `tsc` project: only `scripts/bundleTypes.ts` writes
`dist/types/scriptTypes.js`, with the declaration files of the built
`@jolly-pixel/ecs`, `@jolly-pixel/backend.three` and `@types/three`. A
consumer's `tsc -b` therefore never writes over it:

```bash
$ pnpm run build
$ pnpm run test
$ pnpm run lint
```

## 📃 License

MIT
