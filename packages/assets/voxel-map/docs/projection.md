# Block projection and blockset normal maps

Exported from `@jolly-pixel/asset.voxel-map/client`. These place a blockset's blocks on its atlas as pixel-draw UV geometry, and build the blockset's normal map from that placement.

## `blockShapeUv(shape)`

```ts
blockShapeUv(shape: BlockShape): BlockShapeUv
```

Reads a renderer `BlockShape` as UV slot data: the slots it textures (`activeFaces`), each slot's tile `bounds` and `spans`, the right-angle corner of triangular slots (`triangles`), the parts of slots made of several quads (`parts`, normalized to the slot bounds), the vertex range of each slot (`faceRanges`) and whether the shape is a plain cube (`isBox`).

`uvGeometryForSlot(rect, shapeUv, slot)` turns a slot's rect into its `UVGeometry`: a compound for a multi-part slot, a triangle for a triangular one, the rect otherwise.

## `BlockProjection`

```ts
new BlockProjection(
  block: ResolvedBlockDefinition,
  shape: BlockShape | undefined,
  tileSize: number
)
```

Where a block's textured faces sit on its blockset's atlas, in pixels. An unknown shape (`undefined`) textures nothing.

| Member | Description |
|---|---|
| `BlockProjection.regionIdOf(localBlockId)` | The UV region id of a block: `block-<localBlockId>`. |
| `BlockProjection.localBlockIdOf(regionId)` | The local block id a region id names, or `null` when it names no block. |
| `regionId` | The region id of the block, from its id inside its blockset, so a block keeps its region id whatever slot its blockset takes in a world. |
| `textured` | Whether the shape samples at least one tile. |
| `isBox` | Whether the shape is a plain cube. |
| `layout` | The renderer `BlockTextureLayout`. |
| `shapeUv` | The `BlockShapeUv` of the shape, a whole-tile cube for an unknown shape. |
| `faces()` | The geometry of every textured slot, rotated like its tile, with the tile spans of the shape. |
| `stackedFaces()` | The same geometry, reading every slot as one tile. |
| `islandFaces()` | The faces as pixel-draw `IslandFace`s named after `regionId`, over the tile area the renderer samples: a slot spans more than one tile only when the block has its own texture for it. |

## `BlocksetIslands`

```ts
new BlocksetIslands({
  blockset: Pick<BlocksetDocument, "blocks" | "tileSize" | "subscribe">,
  shapes: Pick<BlockShapeRegistry, "get">
})
```

Builds the normal map islands of a blockset from its blocks' faces, so a tile never samples its neighbour. A normal map zone applies to the islands of the block whose region id it names.

```ts
import { BlocksetIslands } from "@jolly-pixel/asset.voxel-map/client";

const release = new BlocksetIslands({
  blockset: blockset.blockset,
  shapes: view.shapes
}).attachTo(blockset.pixels);
const stopGenerating = blockset.pixels.normals.retain();
```

| Member | Description |
|---|---|
| `faces()` | The `IslandFace`s of every block in the blockset. |
| `attachTo(pixels)` | Makes the pixel document build its islands from `faces()` with [`useIslandFaces`](../../../pixel-draw-renderer/docs/PixelDocument.md#normal-map), and invalidates them when a block is defined or removed, the tile size changes or the blockset loads. Returns the function that stops listening and gives the islands back to the UV map. |

Once attached, the document's [`NormalMap`](../../../pixel-draw-renderer/docs/normal/NormalMap.md) is the blockset's normal map, whether a texture editor or the 3D view reads it. The package does not depend on three. Wrap `pixels.normals` in a texture to pass it to `view.loadBlockset(definition, texture, { normal })`, for instance with pixel-art's `NormalMapTexture`.
