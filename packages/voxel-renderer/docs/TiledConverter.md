# TiledConverter

Converts a Tiled JSON map (`TiledMap`) to `VoxelWorldJSON` for import via `VoxelRenderer.load()`.

Tile layers become voxel layers. Object layers become `VoxelObjectLayerJSON` entries with
pixel-to-voxel coordinate conversion. Group layers are flattened recursively.
Block definitions derived from the tileset are embedded in `result.blocks` so they are
auto-registered when passed to `VoxelRenderer.load()`.

Infinite maps and compressed tile data are not supported.

---

## TiledConverterOptions

```ts
interface TiledConverterOptions {
  /**
   * Resolves a Tiled tileset source path to a runtime URL or asset path.
   * Called once per tileset found in the map.
   */
  resolveTilesetSrc: (tiledSource: string, tilesetId: string) => string;
  /** Side length of each chunk in voxels. Default: `16`. */
  chunkSize?: number;
  /**
   * "stacked" — each Tiled layer is placed at its own Y level (layer index).
   * "flat"    — all layers are placed at Y = 0; higher layers occlude lower ones.
   * Default: "stacked".
   */
  layerMode?: "flat" | "stacked";
  /** Shape ID applied to every voxel. Default: `"fullCube"`. */
  defaultShapeId?: BlockShapeID;
  /** Whether voxels are collidable. Default: `true`. */
  collidable?: boolean;
}
```

---

## TiledConverter

### Methods

#### `convert(map: TiledMap, options: TiledConverterOptions): VoxelWorldJSON`

Converts the Tiled map to a `VoxelWorldJSON` object ready to pass to `VoxelRenderer.load()`.

---

## TiledMap

TypeScript types for the Tiled JSON Map Format 1.11.x. Import `TiledMap` when you need to
type the raw JSON before converting:

```ts
import type { TiledMap } from "@jolly-pixel/voxel.renderer";
```

---

## Example

```ts
import { TiledConverter, VoxelRenderer } from "@jolly-pixel/voxel.renderer";
import type { TiledMap } from "@jolly-pixel/voxel.renderer";

const tiledMap: TiledMap = await fetch("map.json").then(r => r.json());

const converter = new TiledConverter();
const worldJson = converter.convert(tiledMap, {
  resolveTilesetSrc: (_src, tilesetId) => `assets/${tilesetId}.png`,
  layerMode: "stacked"
});

// loadRuntime's ~850 ms splash delay ensures local assets finish before awake() runs,
// so load() can safely be called fire-and-forget here.
vr.load(worldJson);
```
