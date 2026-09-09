# Custom asset loaders

Runtime already registers loaders for the engine's model, font, audio, and
texture asset types. Add a loader definition when a project has another asset
kind.

## Define the asset type and loader

Use one `AssetType` instance for references and loader registration.

```ts
import {
  AssetReference,
  AssetType,
  type AssetRecord,
  type AssetLoader
} from "@jolly-pixel/asset";
import * as THREE from "three/webgpu";

interface TileMap {
  readonly width: number;
  readonly height: number;
}

const TILE_MAP_ASSET = new AssetType<TileMap>("tile-map");

class TileMapAssetLoader implements AssetLoader<TileMap> {
  readonly #loader: THREE.FileLoader<TileMap>;

  constructor(manager: THREE.LoadingManager) {
    this.#loader = new THREE.FileLoader<TileMap>(manager);
    this.#loader.setResponseType("json");
  }

  async load(record: AssetRecord): Promise<TileMap> {
    return await this.#loader.loadAsync(record.source);
  }
}

const worldMap = new AssetReference(
  "world-map",
  TILE_MAP_ASSET
);
```

The Three.js loading manager connects loader activity to the rest of the
runtime's loading infrastructure.

## Register the loader

Pass the definition to `Runtime.create()`:

```ts
import { Runtime } from "@jolly-pixel/runtime";

const runtime = await Runtime.create("canvas", {
  assets: {
    catalog: new URL("assets.json", document.baseURI),
    loaders: [
      {
        type: TILE_MAP_ASSET,
        create: (manager) => new TileMapAssetLoader(manager)
      }
    ]
  }
});
```

The catalog record must use the same kind as the asset type:

```json
{
  "version": 1,
  "assets": [
    {
      "id": "world-map",
      "kind": "tile-map",
      "source": "maps/world.json"
    }
  ]
}
```

Register each asset type once. A definition that duplicates a default or an
earlier custom type causes `Runtime.create()` to reject.

The [runtime asset options](../api/runtime-assets.md) page describes catalog
resolution and loader defaults. The asset package's
[custom runtime integration](../../../asset/docs/guides/custom-runtime-integration.md)
guide covers direct coordinator construction outside `@jolly-pixel/runtime`.
