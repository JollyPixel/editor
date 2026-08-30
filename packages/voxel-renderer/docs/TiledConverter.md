# TiledConverter

Converts a Tiled JSON map (`TiledMap`) to `VoxelWorldJSON` for import via `VoxelEngine.load()`.

- Tile layers become voxel layers.
- Object layers become `VoxelObjectLayerJSON` entries with pixel-to-voxel coordinate conversion.
- Group layers are flattened recursively.

Block definitions derived from the tileset are embedded in `result.blocks` so they are
auto-registered when passed to `VoxelEngine.load()`.

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

const tiledMap = await loadJSON<TiledMap>("map.tmj");

const snapshot = new TiledConverter().convert(tiledMap, {
  resolveTilesetSrc: (_src, tilesetId) => `assets/${tilesetId}.png`,
  layerMode: "stacked"
});
const tilesets = await loadTilesets(snapshot.tilesets);
const engine = new VoxelEngine({ tilesets });

engine.load(snapshot);
```

> [!IMPORTANT]
> Infinite maps and compressed tile data are not supported.

## TiledConverterOptions

```ts
interface TiledConverterOptions {
  /**
   * Maps a Tiled tileset `source` string (e.g. `"TX Tileset Grass.tsx"`) and
   * its derived ID to the actual asset path/URL used for TilesetDefinition.src.
   * Called once per tileset. For embedded tilesets without a source file,
   * `tiledSource` is an empty string and `tilesetId` is the tileset name.
   */
  resolveTilesetSrc: (tiledSource: string, tilesetId: string) => string;

  /**
   * Chunk size written into the VoxelWorldJSON output.
   * @default 16
   */
  chunkSize?: number;

  /**
   * Controls how Tiled tile layers map to the 3-D Y axis.
   *
   * - `"flat"`    — all tile layers are placed at Y=0; when two layers occupy
   *                 the same (x, z) cell the later layer wins.
   * - `"stacked"` — tile layer at index N is placed at Y=N (useful for
   *                 multi-floor or multi-depth maps).
   *
   * @default "flat"
   */
  layerMode?: "flat" | "stacked";

  /**
   * BlockShape ID assigned to every generated block.
   * @default "cube"
   */
  defaultShapeId?: BlockShapeID;

  /**
   * Whether generated blocks are collidable.
   * @default true
   */
  collidable?: boolean;
}
```

## TiledConverter

### Methods

#### `convert(map: TiledMap, options: TiledConverterOptions): VoxelWorldJSON`

Converts the Tiled map to a `VoxelWorldJSON` object ready to pass to `VoxelEngine.load()`.

## TiledMap

TypeScript types for the Tiled JSON Map Format 1.11.x. Import `TiledMap` when you need to
type the raw JSON before converting:

```ts
import type { TiledMap } from "@jolly-pixel/voxel.renderer/plugins/tiled/index.js";
```

## Loading a Tiled map as an asset

`TiledMapAssetLoader` converts the map and loads its tileset textures. It
returns a `VoxelTiledMap`, which contains the `VoxelWorldJSON` and its prepared
`TilesetSource` list.

Register the record in the project catalog and give the runtime the tiled
loader:

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
} from "@jolly-pixel/voxel.renderer/plugins/tiled/index.js";

const mapId = new AssetId("map.intro");
const catalog = new AssetCatalog([
  new AssetRecord({
    id: mapId,
    kind: TiledMapAssetType.kind,
    source: "maps/intro.tmj"
  })
]);

const canvas = document.querySelector("canvas");
if (!canvas) {
  throw new Error("HTMLCanvasElement not found");
}

const runtime = await Runtime.create(canvas, {
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

Declare the reference on the component that consumes it. Include that component's
asset group in the scene, then read the prepared value synchronously during
`awake()`:

```ts
import { AssetReference, type AssetReferenceGroup } from "@jolly-pixel/asset";
import { Actor, ActorComponent, Systems } from "@jolly-pixel/engine";
import { VoxelRenderer } from "@jolly-pixel/voxel.renderer";
import {
  TiledMapAssetType
} from "@jolly-pixel/voxel.renderer/plugins/tiled/index.js";

class VoxelMap extends ActorComponent {
  static readonly assets = {
    map: new AssetReference("map.intro", TiledMapAssetType)
  } satisfies AssetReferenceGroup;

  constructor(actor: Actor) {
    super({ actor, typeName: "VoxelMap" });
  }

  awake(): void {
    const { world, tilesets } = this.getAsset(VoxelMap.assets.map);
    const renderer = this.actor.addComponentAndGet(VoxelRenderer, { tilesets });

    renderer.engine.load(world);
  }
}

class MapScene extends Systems.Scene {
  constructor() {
    super("map", {
      assets: [VoxelMap.assets]
    });
  }

  override awake(): void {
    this.world.createActor("map").addComponent(VoxelMap);
  }
}
```

The loader resolves `.tsx` tileset sources to `.png` files beside the `.tmj`
record source. Pass `TiledMapAssetLoaderOptions` to its constructor to change
converter settings such as `layerMode` or `chunkSize`. Its `layerMode` default is
`"stacked"`. Direct `TiledConverter` calls default to `"flat"`.
