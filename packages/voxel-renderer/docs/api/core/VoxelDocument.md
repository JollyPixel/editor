# VoxelDocument

The voxel data of a world, with no Three.js rendering objects: layers and
voxels, the block registry, the tileset links, undo/redo history, and
the command stream that carries edits between peers.

A document runs headless. Pair it with a [`VoxelView`](./VoxelView.md) to draw
it. Editing the world itself (layers, voxels, objects) goes through
[`document.world`](../world/VoxelWorld.md), which emits the
[commands](./commands.md) the document forwards.

`three` still appears in the types it returns (`Vector3Like`, and `Vector3` and
`Box3` from [`VoxelLayer`](../world/VoxelLayer.md)) because the world does its
geometry in those classes. Nothing here creates an `Object3D`, a material, a
texture or a geometry.

```ts
import {
  VoxelDocument,
  VoxelRotation
} from "@jolly-pixel/voxel.renderer";

const document = new VoxelDocument({
  chunkSize: 16,
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

document.world.setVoxel("Ground", {
  position: { x: 0, y: 0, z: 0 },
  blockId: 1,
  rotation: VoxelRotation.CW90
});
```

## VoxelDocumentOptions

```ts
interface VoxelDocumentOptions {
  /** Power of two; anything else throws a RangeError. @default 16 */
  chunkSize?: number;
  /** Layer names added in order, so the last one ends up on top. */
  layers?: string[];
  /** Block definitions registered before any command is applied. */
  blocks?: BlockDefinition[];
  /** Tileset definitions declared before any texture is registered. */
  tilesets?: Iterable<TilesetDefinition>;
  /** Finishes of the named material groups; invalid entries are skipped. */
  materialGroups?: Iterable<MaterialGroupJSON>;
  /** Undo/redo of voxel edits; disabled by default. */
  history?: VoxelHistoryOptions;
  /** Debug logger; defaults to a no-op implementation. */
  logger?: VoxelLogger;
  /** Subscribed to `"command"` before any command is applied. */
  onCommand?: VoxelCommandListener;
}
```

## Properties

```ts
class VoxelDocument extends BlockDocument<VoxelCommand> {
  readonly world: VoxelWorld;
  readonly blocks: BlockRegistry;
  readonly tilesets: TilesetList;   // links only, no atlases
  readonly materialGroups: MaterialGroupList;
  readonly history: VoxelHistory;   // see VoxelHistory.md
  readonly chunkSize: number;
}
```

`tilesets` holds only what a tileset *is* and the slot it owns. The atlas
textures built from those declarations belong to the view's
[`TilesetAtlases`](../tilesets/TilesetAtlases.md).

`blocks` and `materialGroups` are runtime state. A world saves neither: they
are projected from the [`TilesetDocument`](../tilesets/TilesetDocument.md) of
each linked tileset by the host, or defined in code for a standalone scene.
`materialGroups` holds the [surface finishes](../materials/MaterialGroup.md)
the blocks name.

## Events

```ts
type VoxelDocumentEvents = {
  command: (command: VoxelCommand, context: VoxelCommandContext) => void;
  loaded: () => void;
};
```

- `command` carries every edit, with `origin` `"local"` for a change made here
  and `"remote"` for one replayed through `apply()`. Local layer commands are
  forwarded from [`world`](../world/VoxelWorld.md#commands). A sync client
  broadcasts the [world half](./commands.md#world-and-tileset-document-commands)
  of this stream; block and material group commands are the projection of
  tileset documents and stay local. A direct `blocks` or `tilesets` mutation
  emits nothing, and neither does `load()`.
- `loaded` follows `load()`, once the new world is in place.

## Methods

```ts
apply(command: VoxelCommand, options?: VoxelApplyOptions): boolean;

defineBlock(def: BlockDefinition): boolean;
defineBlocks(defs: Iterable<BlockDefinition>): void;
removeBlock(blockId: number): boolean;
moveBlock(blockId: number, toIndex: number): boolean;
blockAt(position: THREE.Vector3Like): ResolvedBlockDefinition | undefined;
blockPropertiesAt(position: THREE.Vector3Like): BlockProperties | undefined;

addTileset(tileset: TilesetDefinition): boolean;
removeTileset(tilesetId: string): boolean;

defineMaterialGroup(group: MaterialGroup | MaterialGroupJSON): boolean;
removeMaterialGroup(groupId: string): boolean;

save(): VoxelWorldJSON;
load(data: VoxelWorldJSON, options?: VoxelLoadOptions): void;
dispose(): void;
```

`apply()` applies any [command](./commands.md) with
[`applyVoxelCommand()`](./commands.md#applying-commands) and emits it once on
`"command"` with `options.origin`:

```ts
interface VoxelApplyOptions {
  /** @default "local" */
  origin?: "local" | "remote";
}
```

It returns `false` and emits nothing when the command changed nothing, so a
rejected command is never broadcast. An applied command is emitted the way it
was applied: a `block-defined` block carries the default tileset in its
texture references, a `block-moved` carries the index the block landed on, a
`tileset-added` carries the slot the tileset received, and a
`material-group-defined` group has every field filled in. A network adapter
applies peer commands with `{ origin: "remote" }` and sends only the `"local"`
ones, so nothing is echoed back.

The block and material group methods come from `BlockDocument`, the base
[`TilesetDocument`](../tilesets/TilesetDocument.md) shares; each is a
shorthand for `apply()`:

| Method | Command | Returns |
| --- | --- | --- |
| `defineBlock(def)` | `block-defined` | whether the registry changed; an existing ID is overwritten |
| `defineBlocks(defs)` | one `block-defined` per definition | nothing; an empty batch does nothing |
| `removeBlock(blockId)` | `block-removed` | `false` for an unknown ID; IDs are never recycled |
| `moveBlock(blockId, toIndex)` | `block-moved` | `false` for an unknown ID or a move that changes nothing |
| `defineMaterialGroup(group)` | `material-group-defined` | `false` for an invalid finish or one equal to the current definition |
| `removeMaterialGroup(groupId)` | `material-group-removed` | `false` for an unknown group |

Tile references a block defines without `tilesetId` get the first declared
tileset. The order `moveBlock()` changes is a document concern only; see
[`BlockRegistry` ordering](../blocks/BlockRegistry.md#ordering).

`blockAt()` resolves the voxel at a world position to its block definition,
reading the highest-priority layer that holds one. It returns `undefined` for
air and for a voxel whose block is no longer registered. The definition is the
stored one, not a copy; do not mutate it. `blockPropertiesAt()` does the same
lookup and returns a fresh copy of the block's
[custom properties](../blocks/BlockDefinition.md#custom-properties), an empty
object for a block carrying none.

`addTileset()` links a tileset and broadcasts a command; a definition without
`slot` receives the lowest free one. A tileset that arrives with its texture
rather than through an edit is declared with
[`VoxelView.loadTileset()`](./VoxelView.md#methods), which adds or updates it
in `tilesets` without a command.

`save()` writes the world and its tileset links. `load()` replaces the
world, drops the undo history, and emits `loaded`. The snapshot replaces the
tileset list wholesale and leaves `blocks` and `materialGroups` alone, so
`options.tilesets` declarations are applied after it:

```ts
interface VoxelLoadOptions {
  /** Collapses layers; higher-priority voxels win overlaps. */
  mergeLayers?: boolean;
  /** Declared after the snapshot replaced the list. */
  tilesets?: Iterable<TilesetDefinition>;
}
```

`data.chunkSize` is metadata: `load()` keeps the document's chunk size.
Deserialization is silent, so restoring a snapshot emits no command.
