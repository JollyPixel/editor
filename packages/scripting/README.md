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
- outlines the `Behavior` classes of a script for the scene inspector;
- links and loads the build in a game.

## 👀 Usage example

```ts
import {
  buildScript,
  readScriptOutline
} from "@jolly-pixel/scripting";

const source = `
import { Behavior, SceneProperty } from "@jolly-pixel/engine";

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

Runs in Node and in a browser. `buildScript` and `readScriptOutline` need
Node; their browser builds refuse.

```ts
import { buildScript } from "@jolly-pixel/scripting";
```

- [Build](./docs/build.md): `buildScript`, `buildShader` and `SourceError`
- [`ScriptImportPolicy`](./docs/ScriptImportPolicy.md): `SCRIPT_IMPORTS`,
  `SHADER_IMPORTS` and `ScriptImportError`
- [`readScriptOutline`](./docs/readScriptOutline.md): the outline and its
  schemas

### Three

Needs three.js and `@jolly-pixel/engine`.

```ts
import { loadShader } from "@jolly-pixel/scripting/three";
```

- [Loaders](./docs/three/loaders.md): `ScriptModuleLoader`,
  `ShaderModuleLoader` and how scripts link
- [`ShaderModule`](./docs/three/ShaderModule.md): the shader module format,
  `loadShader` and materials

## ✨ Contributors guide

The `#compiler`, `#outliner` and `#stripper` imports resolve to `dist/`, so
tests need a build first:

```bash
$ pnpm run build
$ pnpm run test
$ pnpm run lint
```

## 📃 License

MIT
