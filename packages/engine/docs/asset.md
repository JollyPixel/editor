## Asset Loading

The asset system provides a unified pipeline for loading external resources
(3D models, tiled maps, fonts, textures, audio, etc.). It is built around
two main concepts:

- **Asset** — lightweight descriptor that identifies a file by its
  path, name, extension, and type
- **AssetManager** — orchestrates the full lifecycle:
  enqueue → resolve loader → load → cache

A singleton `Assets` is exported from the engine and serves as the
default entry point for all asset operations.

```ts
import { Systems } from "@jolly-pixel/engine";

const { Assets } = Systems;
```

### Asset

A lightweight value object describing a single resource.

```ts
type AssetTypeName =
  | "unknown"
  | "texture"
  | "audio"
  | "model"
  | "font"
  | (string & {});
```

```ts
interface Asset {
  readonly id: string;
  name: string;
  ext: string;
  path: string;
  type: AssetTypeName;

  get basename(): string;
  get longExt(): string;
  toString(): string;
}
```

If no `type` is given at construction time, the manager resolves it
automatically from the file extension.

### AssetManager

Central façade that owns a loader registry, a waiting queue,
and the loaded-asset cache.

```ts
interface LazyAsset<T = unknown> {
  asset: Asset;
  get: () => T;
}
```

```ts
interface AssetManager {
  // Enqueue an asset and return a lazy handle
  load<T>(assetOrPath: Asset | string): LazyAsset<T>;

  // Retrieve a previously loaded asset by id (throws if missing)
  get<T>(id: string): T;

  // Flush the queue: load every waiting asset in parallel
  loadAssets(context: AssetLoaderContext): Promise<void>;
}
```

### Loading lifecycle

1. **Register loaders** — each loader calls `Assets.registry.loader()`
   at module evaluation time, binding file extensions to a type and
   a loader callback.
2. **Enqueue assets** — game or component code calls `Assets.load(path)`.
   The asset is pushed into an internal queue and a `LazyAsset` handle
   is returned immediately.
3. **Flush the queue** — calling `Assets.loadAssets(context)` drains
   the queue and runs every registered loader in parallel. Each result
   is cached by asset `id`.
4. **Access the result** — call `lazyAsset.get()` to retrieve the
   loaded resource from the cache. Throws if the asset has not been
   loaded yet.

> [!NOTE]
> When `autoload` is `true`, `loadAssets` is scheduled automatically
> after each `load()` call, so you do not need to flush manually.

### Built-in loaders

The engine ships with three loaders. Each one registers itself
when its module is imported.

| Loader | Extensions | Result type |
| ------ | ---------- | ----------- |
| `Loaders.model` | `.obj`, `.fbx`, `.glb`, `.gltf` | `Model` (`THREE.Group` + `AnimationClip[]`) |
| `Loaders.tiledMap` | `.tmj` | `TiledMapAsset` (map data + tileset textures) |
| `Loaders.font` | `.typeface.json` | `Font` (Three.js typeface) |

Usage:

```ts
import { Loaders } from "@jolly-pixel/engine";

// Enqueue assets
const knight = Loaders.model("models/knight.glb");
const level = Loaders.tiledMap("maps/level1.tmj");
const myFont = Loaders.font("fonts/roboto.typeface.json");

// After loadAssets():
const { object, animations } = knight.get();
const { tilemap, tilesets } = level.get();
const font = myFont.get();
```

### Writing a custom loader

To add support for a new file format, register a loader on the
global `Assets.registry`:

```ts
import {
  Systems,
  type Asset,
  type AssetLoaderContext
} from "@jolly-pixel/engine";

const { Assets } = Systems;

Assets.registry.loader(
  {
    extensions: [".csv"],
    type: "spreadsheet"
  },
  async(asset: Asset, _context: AssetLoaderContext) => {
    const response = await fetch(asset.toString());
    const text = await response.text();

    return text
      .split("\n")
      .map((row) => row.split(","));
  }
);

export const spreadsheet = Assets.lazyLoad<string[][]>();
```

The `context.manager` property is the shared `THREE.LoadingManager`
instance, which can be passed to any Three.js loader to benefit from
centralized progress tracking.
