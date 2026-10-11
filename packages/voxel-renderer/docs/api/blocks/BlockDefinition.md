# BlockDefinition

The authoring form of a block, accepted by `VoxelDocument.defineBlock()`,
`BlockRegistry.register()` and `VoxelDocumentOptions.blocks`.

```ts
document.defineBlock({
  id: 2,
  name: "Stained glass",
  shapeId: "cube",
  defaultTexture: { blocksetId: "default", col: 4, row: 1 },
  alphaMode: "blend",
  cullCoveredFaces: true
});
```

## Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `id` | `number` | required | Block id; `0` is air and throws. See [block ids](#block-ids). |
| `name` | `string` | required | Display name. |
| `shapeId` | `BlockShapeID` | required | A shape registered on the view, see [`BlockShape`](./BlockShape.md). |
| `faceTextures` | `Partial<Record<TextureSlotKey, TileRef>>` | `{}` | Tile per [texture slot](./BlockTextures.md#texture-slots). |
| `defaultTexture` | `TileRef` | none | Tile of every slot `faceTextures` leaves out. |
| `collidable` | `boolean` | `true` | `false` emits no collision geometry. |
| `alphaMode`, `side`, `alphaCutoff`, `materialGroup` | | | Surface settings, see [`BlockSurface`](./BlockSurface.md). |
| `blendGroup` | `string` | none | [`BlendGroup`](../materials/BlendGroup.md) that fades the top and bottom faces into neighbours. Opaque blocks only. |
| `cullCoveredFaces` | `boolean` | `true` for opaque, `false` otherwise | See [covered faces](#covered-faces). |
| `defaultBlocksetId` | `string` | none | Blockset of tile references that omit one. Removed once resolved. |
| `properties` | `BlockProperties` | `{}` | Game data, see [custom properties](#custom-properties). |

A `faceTextures` key that matches no slot of the shape is ignored, and the view
logs a warning for it. A numeric `Face` key is read as that face's slot.

`blendGroup` must be a non-empty string. A block naming a group the document
does not define never blends.

## Covered faces

With `cullCoveredFaces: true`, faces shared by two voxels of the same block are
removed, and so is a face an opaque neighbour covers. With `false`, those
faces are kept, so a glass or foliage volume shows its inner faces through its
own holes. Keeping them costs geometry: a solid volume then emits six faces per
voxel. Set `true` on dense volumes such as a canopy.

`cullsCoveredFaces(definition)` returns the resolved value.

## Custom properties

```ts
type BlockProperties = Record<string, string | number | boolean>;
```

`properties` carries data for game code. The renderer never reads it.

```ts
document.defineBlock({
  id: 3,
  name: "Ice",
  shapeId: "cube",
  properties: {
    friction: 0.02,
    slippery: true
  }
});
```

Values are limited to strings, booleans and finite numbers. Anything else
(objects, arrays, `null`, `undefined`, `NaN`, `Infinity`) is dropped on
resolution, as is a `__proto__` key. `resolveBlockProperties(properties)`
applies the same filter. A resolved definition always has a `properties` map.

Read them with [`BlockRegistry.copyProperties()`](./BlockRegistry.md#reading),
or by world position with
[`VoxelDocument.blockPropertiesAt()`](../core/VoxelDocument.md#methods).

## ResolvedBlockDefinition

```ts
function resolveBlockDefinition(
  definition: BlockDefinition
): ResolvedBlockDefinition;
```

The form `BlockRegistry` stores: defaults applied, `faceTextures` and
`properties` always present, `collidable` set, `defaultBlocksetId` folded into
the tile references. It returns a new object and leaves the input untouched.

## Block ids

```ts
const AIR_BLOCK_ID = 0;
const LOCAL_BLOCK_ID_BITS = 16;
const MAX_LOCAL_BLOCK_ID = 0xFFFF;
const MAX_BLOCKSET_SLOT = 0x7F;

function isAir(blockId: number): boolean;
function composeBlockId(slot: number, localId: number): number;
function decodeBlocksetSlot(blockId: number): number;
function decodeLocalBlockId(blockId: number): number;
function isBlocksetSlot(value: unknown): value is number;
function isLocalBlockId(value: unknown): value is number;
```

Id `0` is air and is never stored: registering it throws `Error`, writing it
throws `RangeError`. Use `removeVoxel()` to clear a cell.

A world block id combines a blockset [slot](../blocksets/blocksets.md) and the
block's id inside that blockset. Slot `0` leaves a local id unchanged, so blocks
defined in code need no slots. `composeBlockId()` throws `RangeError` for a
slot above `MAX_BLOCKSET_SLOT`, a local id of `0` or above `MAX_LOCAL_BLOCK_ID`,
or a non-integer. `decodeBlocksetSlot()` and `decodeLocalBlockId()` split an id back.
