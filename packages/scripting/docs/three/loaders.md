# Loaders

Asset loaders that import the build of a script or shader asset in the page.
The code runs with the rights of the viewer, as a game would.

```ts
import { SCRIPT_MODULE_ASSET, ShaderAssetType } from "@jolly-pixel/engine";
import {
  ScriptModuleLoader,
  ShaderModuleLoader
} from "@jolly-pixel/scripting/three";

const loaders = [
  { type: SCRIPT_MODULE_ASSET, create: (manager) => new ScriptModuleLoader(manager) },
  { type: ShaderAssetType, create: (manager) => new ShaderModuleLoader(manager) }
];
```

## ScriptModuleLoader

```ts
class ScriptModuleLoader implements AssetLoader<ScriptModule> {
  constructor(manager: THREE.LoadingManager);
  load(record: AssetRecord, context: AssetLoadContext): Promise<ScriptModule>;
}
```

Fetches the build at the asset path and imports it as a module.

### Modules

Each import of `three`, `three/webgpu`, `three/tsl` or `@jolly-pixel/engine`
becomes a `data:` module over the game's own copy, so a script extends the
same `Behavior` class the game runs. Any other bare specifier is refused with
the [`SCRIPT_IMPORTS`](../ScriptImportPolicy.md) message.

### Other scripts

A `./` or `../` import names another script asset, resolved against the
importing script's path. For `./player.js`, the loader tries `./player.js`,
`./player.js.ts` and `./player.ts`; for `./player`, `./player` and
`./player.ts`.

- The imported script links first.
- Every script that imports it links the same `data:` URL, so it is evaluated
  once.
- Two scripts that import each other throw a `ScriptImportError` naming both
  paths. An `import type` breaks the cycle, because the build drops it.
- A path that names no script asset throws a `ScriptImportError`.

## ShaderModuleLoader

```ts
class ShaderModuleLoader implements AssetLoader<ShaderModule> {
  constructor(manager: THREE.LoadingManager);
  load(record: AssetRecord): Promise<ShaderModule>;
}
```

Fetches the build at the asset path and loads it as a
[`ShaderModule`](./ShaderModule.md). A shader may import `three`,
`three/webgpu` and `three/tsl` only.
