# VoxelDocument

The voxel data of a world: layers, the block registry, blockset links, undo
history and the command stream. It creates no Three.js objects; pair it with a
[`VoxelView`](./VoxelView.md) to draw it.

```ts
import { VoxelDocument } from "@jolly-pixel/voxel.renderer";

const document = new VoxelDocument({
  layers: ["Ground"],
  blocks: [
    {
      id: 1,
      name: "Grass",
      shapeId: "cube",
      collidable: true,
      faceTextures: {},
      defaultTexture: { col: 0, row: 0 }
    }
  ]
});

document.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: 1 });
```

Layer, voxel and object edits go through
[`document.world`](../world/VoxelWorld.md).

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `chunkSize` | `number` | `16` | Chunk edge in voxels. Must be a power of two, otherwise a `RangeError` is thrown. |
| `layers` | `string[]` | `[]` | Layer names added in order; the last one ends up on top. |
| `blocks` | `BlockDefinition[]` | `[]` | Registered before any command is applied. |
| `blocksets` | `Iterable<BlocksetDefinition>` | | Blockset links declared up front. |
| `materialGroups` | `Iterable<MaterialGroupJSON>` | `[]` | Material groups the blocks can name. Invalid entries are skipped. |
| `blendGroups` | `Iterable<BlendGroupJSON>` | `[]` | Blend groups the blocks can name. Invalid entries are skipped. |
| `history` | `VoxelHistoryOptions` | disabled | See [`VoxelHistory`](./VoxelHistory.md). |
| `logger` | `VoxelLogger` | no-op | |
| `onCommand` | `VoxelCommandListener` | | Subscribed to `"command"` before any command is applied. |

## Properties

```ts
class VoxelDocument {
  readonly world: VoxelWorld;
  readonly blocks: BlockRegistry;
  readonly blocksets: BlocksetList;
  readonly materialGroups: MaterialGroupList;
  readonly blendGroups: BlendGroupList;
  readonly history: VoxelHistory;
  readonly chunkSize: number;
}
```

- [`blocks`](../blocks/BlockRegistry.md),
  [`materialGroups`](../materials/MaterialGroup.md) and
  [`blendGroups`](../materials/BlendGroup.md) are runtime state. A saved world
  holds its layers and blockset links only; the host projects blocks and groups
  from each linked [`BlocksetDocument`](../blocksets/BlocksetDocument.md), or
  defines them in code.
- [`blocksets`](../blocksets/blocksets.md) holds blockset definitions and their
  slots, not textures. Atlases belong to the view's
  [`BlocksetAtlases`](../blocksets/BlocksetAtlases.md).

## Events

| Event | Arguments | When |
| --- | --- | --- |
| `command` | `(command, { origin })` | After every applied [command](./commands.md), local or replayed. |
| `loaded` | | After `load()` put the new world in place. |

`load()` and direct `blocks` or `blocksets` mutations emit no command.

## Methods

### Commands

```ts
apply(command: VoxelCommand, options?: { origin?: "local" | "remote" }): boolean;
```

Applies a command and emits it once on `"command"` with `options.origin`
(default `"local"`). Returns `false` and emits nothing when the command changed
nothing. See [commands](./commands.md) for what each command carries once
applied.

The block and group methods below are shorthands for `apply()`:

| Method | Command | Returns `false` when |
| --- | --- | --- |
| `defineBlock(def)` | `block-defined` | the registry did not change. An existing ID is overwritten. |
| `defineBlocks(defs)` | one `block-defined` each | returns nothing |
| `removeBlock(blockId)` | `block-removed` | the ID is unknown. IDs are never reused. |
| `moveBlock(blockId, toIndex)` | `block-moved` | the ID is unknown or the move changes nothing |
| `defineMaterialGroup(group)` | `material-group-defined` | the finish is invalid or equal to the current one |
| `removeMaterialGroup(groupId)` | `material-group-removed` | the group is unknown |
| `defineBlendGroup(group)` | `blend-group-defined` | the settings are invalid or equal to the current ones |
| `removeBlendGroup(groupId)` | `blend-group-removed` | the group is unknown |
| `addBlockset(blockset)` | `blockset-added` | the list did not change. Without `slot`, the lowest free slot is assigned. |
| `removeBlockset(blocksetId)` | `blockset-removed` | the blockset is unknown |

A tile reference without `blocksetId` gets the first declared blockset. To declare
a blockset locally without a command, use
[`VoxelView.loadBlockset()`](./VoxelView.md#methods).

### Queries

```ts
blockAt(position: THREE.Vector3Like): ResolvedBlockDefinition | undefined;
blockPropertiesAt(position: THREE.Vector3Like): BlockProperties | undefined;
```

`blockAt()` returns the definition of the visible voxel at `position`, or
`undefined` for air or an unregistered block. The result is the stored object;
do not mutate it. `blockPropertiesAt()` returns a copy of that block's
[custom properties](../blocks/BlockDefinition.md#custom-properties), or `{}`.

### Save and load

```ts
save(): VoxelWorldJSON;
load(data: VoxelWorldJSON, options?: VoxelLoadOptions): void;
dispose(): void;

interface VoxelLoadOptions {
  mergeLayers?: boolean | VoxelMergeAllLayersOptions;
  blocksets?: Iterable<BlocksetDefinition>;
}
```

`save()` writes the world and its blockset links in the
[serialized format](../serialization/serialization.md).

`load()` replaces the world and the blockset list, clears the undo history and
emits `loaded`. It emits no command and leaves `blocks` and the groups alone.
The document keeps its own `chunkSize`. `options.blocksets` are declared after
the snapshot. `mergeLayers` collapses the layers as
[`world.mergeAllLayers()`](../world/VoxelWorld.md) does; an `except`
name with no matching layer logs a warning.

`dispose()` clears the history, the blockset list and every listener.
