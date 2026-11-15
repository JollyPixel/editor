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
  load(record: AssetRecord): Promise<ScriptModule>;
}
```

Imports the URL the manager's URL modifier gives the asset path, with the
browser's own `import()`. The build is not linked: its imports resolve
through the import map of the page.

### Import map

The page must map each import a script may make:

- `three`, `three/webgpu`, `three/tsl` and `@jolly-pixel/engine` to modules
  that re-export the game's own copy, so a script extends the same
  `Behavior` class the game runs;
- each script, under every form a `./` or `../` import may name it, to the
  URL the URL modifier gives its path. For `player.ts`, the forms are
  `player`, `player.ts` and `player.js`. A script whose path is the exact
  form wins over another script's derived form.

Scripts must be served in their project folder layout under a common
directory, because a relative import resolves against the URL its script was
fetched from. Every script that imports another gets the same URL, so a
script is evaluated once, and scripts may import each other.

An import the map does not name fails to load, with the browser's message.

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
