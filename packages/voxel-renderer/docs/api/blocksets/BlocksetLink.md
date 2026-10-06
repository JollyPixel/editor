# BlocksetLink

Keeps a world document in step with a [`BlocksetDocument`](./BlocksetDocument.md).
A blockset document numbers its blocks from `1` and its tile references name no
blockset; the link projects them into the world through the blockset's
[slot](./blocksets.md#definitions).

```ts
import { BlocksetLink, BlocksetSlot } from "@jolly-pixel/voxel.renderer";

const link = new BlocksetLink({
  document: view.document,
  blockset,
  slot: new BlocksetSlot({ id: "terrain", slot: 2 })
});

link.defineBlock({ id: link.nextBlockId, name: "Moss", shapeId: "cube" });
link.dispose();
```

## BlocksetSlot

A blockset id paired with its slot.

```ts
new BlocksetSlot({ id: string, slot: number })
```

Throws a `RangeError` for a slot outside `0..MAX_BLOCKSET_SLOT`.

| Member | Description |
| --- | --- |
| `id`, `slot` | Read-only. |
| `blockId(localId)` | The world block id, `composeBlockId(slot, localId)`. |
| `localBlockId(blockId)` | The blockset-local id of a world block id. |
| `owns(blockId)` | Whether a world block id belongs to this slot. |
| `groupId(localId)` | A group id prefixed with `"<blocksetId>/"`. |
| `localGroupId(groupId)` | The prefix stripped, or `null` for a group of another blockset. |
| `equals(other)` | Compares by value. |
| `toJSON()` | `{ id, slot }`. |

## BlocksetLink

| Option | Type | Description |
| --- | --- | --- |
| `document` | `VoxelDocument` | The world document to fill. |
| `blockset` | `BlocksetDocument` | The source. |
| `slot` | `BlocksetSlot` | Where its blocks land. |

The constructor projects every block, material group and blend group of the
blockset into the document: block ids go through the slot, tile references name
the blockset, and group ids get the `"<blocksetId>/"` prefix. Blocks and groups
of the slot that the blockset no longer has are removed. After that, every
blockset command, a tile size change included, is replayed on the document.

#### `nextBlockId: number`

The world id the blockset gives its next block.

#### `defineBlock(block: BlockDefinition): boolean`

#### `removeBlock(blockId: number): boolean`

#### `moveBlock(blockId: number, toIndex: number): boolean`

#### `defineMaterialGroup(group: MaterialGroupJSON): boolean`

#### `removeMaterialGroup(groupId: string): boolean`

#### `renameMaterialGroup(groupId: string, to: string): boolean`

Edit the blockset with world ids; the change reaches the document through the
link. `moveBlock()` reads `toIndex` as a position among the document's blocks
without the moved one. `removeMaterialGroup()` and `renameMaterialGroup()`
return `false` for a group of another blockset.

#### `dispose(): void`

Stops listening and removes everything the slot projected from the document.
