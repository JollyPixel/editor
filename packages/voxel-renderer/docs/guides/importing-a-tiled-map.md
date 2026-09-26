# Importing a Tiled map

Use `TiledConverter` when application code already loads the Tiled JSON.

```ts
import { loadJSON } from "@jolly-pixel/engine";
import {
  VoxelEngine,
  loadTilesets
} from "@jolly-pixel/voxel.renderer";
import {
  TiledConverter,
  type TiledMap
} from "@jolly-pixel/voxel.renderer/plugins/tiled/index.js";

const map = await loadJSON<TiledMap>("map.tmj");
const { world, blocks } = new TiledConverter().convert(map, {
  resolveTilesetSrc: (_source, id) => `assets/${id}.png`,
  layerMode: "stacked"
});

const tilesets = await loadTilesets(world.tilesets);
const engine = new VoxelEngine({ tilesets, blocks });

engine.load(world);
```

Use `"flat"` when Tiled layers should overlap at y = 0. Use `"stacked"` when
each layer represents another height or floor.

## Load through the asset system

`TiledMapAssetLoader` packages the converted document and textures as one asset.

```ts
import {
  AssetCatalog,
  AssetId,
  AssetRecord
} from "@jolly-pixel/asset";
import { Runtime } from "@jolly-pixel/runtime";
import {
  TiledMapAssetLoader,
  TiledMapAssetType
} from "@jolly-pixel/voxel.renderer/plugins/tiled/asset.ts";

const mapId = new AssetId("map.intro");
const catalog = new AssetCatalog([
  new AssetRecord({
    id: mapId,
    kind: TiledMapAssetType.kind,
    source: "maps/intro.tmj"
  })
]);

const runtime = await Runtime.create("canvas", {
  assets: {
    catalog,
    loaders: [{
      type: TiledMapAssetType,
      create(manager) {
        return new TiledMapAssetLoader(manager, {
          layerMode: "stacked"
        });
      }
    }]
  }
});
```

Read the prepared asset during the component lifecycle:

```ts
const { world, blocks, tilesets } = this.getAsset(VoxelMap.assets.map);
const engine = new VoxelEngine({ tilesets, blocks });

this.actor.object3D.add(engine.root);
engine.load(world);
```

See [`TiledConverter`](../api/tiled/TiledConverter.md) for conversion options.
See [`TiledMapAssetLoader`](../api/tiled/TiledMapAssetLoader.md) for its defaults
and output types.
