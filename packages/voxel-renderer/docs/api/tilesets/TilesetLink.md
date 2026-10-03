# TilesetLink

Keeps a world document in step with a [`TilesetDocument`](./TilesetDocument.md).
A tileset document numbers its blocks from `1` and its tile references name no
tileset; the link projects them into the world through the tileset's
[slot](./tilesets.md#definitions).

```ts
import { TilesetLink, TilesetSlot } from "@jolly-pixel/voxel.renderer";

const link = new TilesetLink({
  document: view.document,
  tileset,
  slot: new TilesetSlot({ id: "terrain", slot: 2 })
});

link.defineBlock({ id: link.nextBlockId, name: "Moss", shapeId: "cube" });
link.dispose();
```

## TilesetSlot

A tileset id paired with its slot.

```ts
new TilesetSlot({ id: string, slot: number })
```

Throws a `RangeError` for a slot outside `0..MAX_TILESET_SLOT`.

| Member | Description |
| --- | --- |
| `id`, `slot` | Read-only. |
| `blockId(localId)` | The world block id, `composeBlockId(slot, localId)`. |
| `localBlockId(blockId)` | The tileset-local id of a world block id. |
| `owns(blockId)` | Whether a world block id belongs to this slot. |
| `groupId(localId)` | A group id prefixed with `"<tilesetId>/"`. |
| `localGroupId(groupId)` | The prefix stripped, or `null` for a group of another tileset. |
| `equals(other)` | Compares by value. |
| `toJSON()` | `{ id, slot }`. |

## TilesetLink

| Option | Type | Description |
| --- | --- | --- |
| `document` | `VoxelDocument` | The world document to fill. |
| `tileset` | `TilesetDocument` | The source. |
| `slot` | `TilesetSlot` | Where its blocks land. |

The constructor projects every block, material group and blend group of the
tileset into the document: block ids go through the slot, tile references name
the tileset, and group ids get the `"<tilesetId>/"` prefix. Blocks and groups
of the slot that the tileset no longer has are removed. After that, every
tileset command, a tile size change included, is replayed on the document.

#### `nextBlockId: number`

The world id the tileset gives its next block.

#### `defineBlock(block: BlockDefinition): boolean`

#### `removeBlock(blockId: number): boolean`

#### `moveBlock(blockId: number, toIndex: number): boolean`

#### `defineMaterialGroup(group: MaterialGroupJSON): boolean`

#### `removeMaterialGroup(groupId: string): boolean`

Edit the tileset with world ids; the change reaches the document through the
link. `moveBlock()` reads `toIndex` as a position among the document's blocks
without the moved one. `removeMaterialGroup()` returns `false` for a group of
another tileset.

#### `dispose(): void`

Stops listening and removes everything the slot projected from the document.
