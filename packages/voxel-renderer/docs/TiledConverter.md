# TiledConverter

Converts a Tiled JSON map (`TiledMap`) to `VoxelWorldJSON` for import via `VoxelRenderer.load()`.

- Tile layers become voxel layers.
- Object layers become `VoxelObjectLayerJSON` entries with pixel-to-voxel coordinate conversion.
- Group layers are flattened recursively.

Block definitions derived from the tileset are embedded in `result.blocks` so they are
auto-registered when passed to `VoxelRenderer.load()`.

```ts
import { loadJSON } from "@jolly-pixel/engine";
import {
  TiledConverter,
  VoxelRenderer,
  type TiledMap
} from "@jolly-pixel/voxel.renderer";

const tiledMap = loadJSON<TiledMap>("map.tmj");

const vr = new VoxelRenderer({});
vr.load(
  new TiledConverter().convert(tiledMap, {
    resolveTilesetSrc: (_src, tilesetId) => `assets/${tilesetId}.png`,
    layerMode: "stacked"
  })
);
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
   * @default "fullCube"
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

Converts the Tiled map to a `VoxelWorldJSON` object ready to pass to `VoxelRenderer.load()`.

## TiledMap

TypeScript types for the Tiled JSON Map Format 1.11.x. Import `TiledMap` when you need to
type the raw JSON before converting:

```ts
import type { TiledMap } from "@jolly-pixel/voxel.renderer";
```

## Example

You can also build this with an ActorComponent and `loadVoxelTiledMap` (which use the Asset system of JollyPixel).

```ts
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import {
  loadVoxelTiledMap,
  VoxelRenderer
} from "@jolly-pixel/voxel.renderer";

export class VoxelBehavior extends ActorComponent {
  world = loadVoxelTiledMap("map.tmj", {
    layerMode: "stacked"
  });
  voxelRenderer: VoxelRenderer;

  constructor(
    actor: Actor
  ) {
    super({
      actor,
      typeName: "VoxelBehavior"
    });
  }

  awake() {
    const world = this.world.get();

    const vr = this.actor.getComponent(VoxelRenderer);
    if (!vr) {
      throw new Error("VoxelRenderer component not found on actor");
    }
    this.voxelRenderer = vr;
    voxelRenderer
      .load(world)
      .catch(console.error);
  }
}
```
