# BlockTextures

Which tile each part of a block samples. A block keys its `faceTextures` by
texture slot; `BlockTextures` resolves a slot to its tile, and the layout
helpers tell where those tiles land on the shape.

```ts
import { BlockTextures } from "@jolly-pixel/voxel.renderer";

const textures = BlockTextures.of(block);
const tread = textures.forSlot("top.1");
```

## Texture slots

Every face of a shape belongs to one texture slot, and a slot samples one tile.
A cube has six slots named after its sides: `right`, `left`, `top`, `bottom`,
`front` and `back`. A shape with several faces on one side gets extra slots:

- faces on the same plane share a slot;
- the plane nearest the cell boundary takes the bare side name, and each
  plane further in takes the next suffix (`top.1`, `top.2`);
- a face not parallel to its side, such as a ramp slope, gets a slot of its
  own.

A `stair` has eight slots:

| Slot | Faces |
|---|---|
| `bottom`, `front` | one each |
| `right`, `left` | two coplanar quads each, an L shape |
| `top`, `top.1` | the upper platform, then the tread below it |
| `back`, `back.1` | the low end face, then the riser behind it |

The [built-in shapes table](./BlockShape.md#built-in-shapes) lists the slots of
each shape. A slot keeps the part of the tile its faces cover, so a stair's
`top` and `top.1` each take half a tile and pointing both at one tile draws a
whole tile across the two steps.

```ts
function shapeSlots(shape: BlockShape): readonly ShapeSlot[];

interface ShapeSlot {
  id: string;
  face: Face;
  definitions: readonly FaceDefinition[];
  span: Readonly<TileSpan>;
}
```

`shapeSlots()` returns the same array for the same shape, so results can be
compared by identity. `span` is the [span](./BlockShape.md#slanted-faces) its
faces share, or `{ u: 1, v: 1 }` when they differ.

### Slot keys

```ts
const FACE_SLOT_NAMES: readonly [
  "right", "left", "top", "bottom", "front", "back"
];
type FaceSlotName = typeof FACE_SLOT_NAMES[number];
type TextureSlotKey =
  | FaceSlotName
  | `${FaceSlotName}.${number}`
  | Face
  | (string & {});

function slotNameOf(face: Face): FaceSlotName;
function slotKeyOf(key: string): string;
function baseSlotOf(slot: string): string;
function unknownTextureSlots(
  keys: Iterable<string>,
  shape: BlockShape
): string[];
```

`TextureSlotKey` accepts any string, since a shape may pin custom slot names,
so it does not catch a typo. `slotKeyOf()` turns a numeric `Face` key into its
slot name. `baseSlotOf()` strips the suffix: `"top.1"` gives `"top"`.

`unknownTextureSlots()` returns the keys that texture nothing on `shape`. The
six side names always count as known, so one texture map can serve a cube and
a ramp. The view logs a warning for unknown keys when it builds a block.

### Pinning a slot

A face with a `slot` joins that slot whatever plane it lies on, and keeps the
same slot id if its geometry later moves.

```ts
defineFace({
  face: Face.PosY,
  normal: [0, 1, 0],
  vertices: [[0, 1, 1], [1, 1, 1], [1, 1, 0]],
  slot: "top"
});
```

## BlockTextures

```ts
type TileRefMapper = (ref: ResolvedTileRef) => ResolvedTileRef;

class BlockTextures implements Iterable<ResolvedTileRef> {
  static of(block: ResolvedBlockDefinition): BlockTextures;
  constructor(
    faceTextures: Readonly<Record<string, ResolvedTileRef>>,
    defaultTexture?: ResolvedTileRef
  );

  readonly faceTextures: Readonly<Record<string, ResolvedTileRef>>;
  readonly defaultTexture: ResolvedTileRef | undefined;
  readonly size: number | undefined;

  forSlot(slot: string): ResolvedTileRef | undefined;
  spanFor(slot: string, span: Readonly<TileSpan>): Readonly<TileSpan>;
  blocksetIds(): string[];
  staysOnGrid(rescale: TileRescale): boolean;
  map(mapper: TileRefMapper): BlockTextures;
  withBlockset(blocksetId: string | null): BlockTextures;
  withSize(size: number): BlockTextures;
  applyTo(block: ResolvedBlockDefinition): ResolvedBlockDefinition;
}
```

The instance is frozen and `of()` does not copy the block's records; treat
them as read-only. Iteration yields every face reference, then
`defaultTexture`.

| Member | Description |
|---|---|
| `forSlot()` | The slot's tile: the exact slot, then its base slot, then `defaultTexture`. |
| `spanFor()` | `span` when the slot or its base slot has its own tile, `{ u: 1, v: 1 }` when it falls back to `defaultTexture`. |
| `size` | `size` of `defaultTexture`, or of the first face reference. |
| `blocksetIds()` | Distinct explicit blockset ids. |
| `staysOnGrid()` | Whether every reference keeps whole `col` and `row` through [`rescaleTileRef()`](../blocksets/blocksets.md). Check it before resizing a blockset's tiles. |
| `map()` | Applies `mapper` to every reference; returns the same instance when nothing changed. |
| `withBlockset()` | Sets `blocksetId` on references without one; `null` returns the same instance. |
| `withSize()` | Sets `size` on every reference. |
| `applyTo()` | `block` with these textures; `block` itself when they are unchanged. |

```ts
const assigned = BlockTextures.of(block)
  .withBlockset(document.blocksets.defaultBlocksetId)
  .applyTo(block);
```

## Texture layout

Use the layout to find where a block's tiles land, for example in a UV editor
or an atlas packer. Use [`buildShapeGeometry()`](#shape-geometry) or
[`BlockPieces`](./BlockPieces.md) when you need geometry to draw.

```ts
function shapeTextureLayout(shape: BlockShape): ShapeTextureLayout;
function resolvedBlockTextureSlots(
  block: ResolvedBlockDefinition,
  shape: BlockShape
): readonly ResolvedBlockTextureSlot[];

interface ShapeTextureLayout {
  slots: readonly ShapeTextureSlotLayout[];
  isBox: boolean;
}

interface ShapeTextureSlotLayout {
  slot: string;
  bounds: TileBounds;
  parts: readonly ShapeTexturePart[];
  span: Readonly<TileSpan>;
  start: number;
  count: number;
}

interface ShapeTexturePart {
  bounds: TileBounds;
  corner: ShapeTextureCorner | null;
}

type ShapeTextureCorner =
  "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface ResolvedBlockTextureSlot extends ShapeTextureSlotLayout {
  tile: ResolvedTileRef;
}
```

`shapeTextureLayout()` gives each slot's area of the tile in normalized
coordinates, its parts (a triangle part names its right-angle `corner`) and
its vertex range. `isBox` is `true` only for six full-tile slots, as on a
cube.

`resolvedBlockTextureSlots()` adds the tile each slot samples, following
`forSlot()`, and leaves out slots without one.

```ts
class BlockTextureLayout {
  static of(
    block: ResolvedBlockDefinition,
    shape: BlockShape | undefined
  ): BlockTextureLayout;

  readonly block: ResolvedBlockDefinition;
  readonly slots: readonly ResolvedBlockTextureSlot[];

  usesBlockset(blocksetId: string): boolean;
  slotsIn(blocksetId: string): ResolvedBlockTextureSlot[];
  drawnRectsIn(blocksetId: string, tileSize: number): TileRect[];
  footprintsIn(blocksetId: string, tileSize: number): TileRect[];
}
```

The same resolved slots for one block, queried by blockset. Only slots the shape
draws count, and a block with an unknown shape has none. `drawnRectsIn()`
returns the distinct texel rectangles the block samples. `footprintsIn()`
returns the whole tiles it references, stretched by the longest span drawing
them; use it to find free room in an atlas.

## Shape geometry

```ts
function buildShapeGeometry(
  shape: BlockShape,
  transform?: VoxelTransform
): ShapeGeometry;

interface ShapeGeometry {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
  ranges: readonly ShapeFaceRange[];
}

interface ShapeFaceRange {
  slot: string;
  face: Face;
  start: number;
  count: number;
  definitions: readonly FaceDefinition[];
  span: Readonly<TileSpan>;
}
```

Builds one indexed mesh of a single block, for a thumbnail or a preview.
Positions are in block space, `0` to `1`; UVs are in tile space, before any
atlas mapping. `transform` (default `VoxelTransform.Identity`) applies a
voxel's rotation and flips. `ranges` has one entry per slot the shape draws,
ordered by `Face`, with the vertex range to remap into that slot's tile.
[`BlockPieces`](./BlockPieces.md) does that remapping for you.
