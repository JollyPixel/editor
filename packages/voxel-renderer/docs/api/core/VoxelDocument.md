# VoxelDocument

The voxel data of a world, with no Three.js rendering objects: layers and
voxels, the block registry, the tileset links, undo/redo history, and
the command stream that carries edits between peers.

A document runs headless. Pair it with a [`VoxelView`](./VoxelView.md) to draw
it, or with [`VoxelEngine`](./VoxelEngine.md), which composes both.

`three` still appears in the types it returns (`Vector3Like`, and `Vector3` and
`Box3` from [`VoxelLayer`](../world/VoxelLayer.md)) because the world does its
geometry in those classes. Nothing here creates an `Object3D`, a material, a
texture or a geometry.

```ts
import { VoxelDocument } from "@jolly-pixel/voxel.renderer";

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
  blockId: 1
});
```

## VoxelDocumentOptions

```ts
interface VoxelDocumentOptions {
  /** @default 16 */
  chunkSize?: number;
  layers?: string[];
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
class VoxelDocument extends Emitter<VoxelDocumentEvents> {
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
[`TilesetManager`](../tilesets/TilesetManager.md).

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
  and `"remote"` for one replayed through `apply()`. A sync client broadcasts
  the [world half](./commands.md#world-and-tileset-document-commands) of this
  stream; block and material group commands are the projection of tileset
  documents and stay local.
- `loaded` follows `load()`, once the new world is in place.

## Methods

```ts
apply(command: VoxelCommand, options?: { origin?: "local" | "remote"; }): boolean;

defineBlock(def: BlockDefinition): void;
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

`apply()` returns `false` when the command changed nothing, and emits no event
in that case. A rejected command is never broadcast. An applied command is
emitted the way it was applied: a `block-defined` block carries the default
tileset in its texture references, a `block-moved` carries the index the block
landed on, a `tileset-added` carries the slot the tileset received, and a
`material-group-defined` group has every field filled in.

`addTileset()` links a tileset and broadcasts a command; a definition without
`slot` receives the lowest free one. A tileset that arrives with its texture
rather than through an edit is declared with
[`VoxelView.loadTileset()`](./VoxelView.md), which adds or updates it in
`tilesets` without a command; that is also how the tile size of an `asset`
tileset reaches the document.

`defineMaterialGroup()` adds or replaces a group and broadcasts it with every
field filled in. It returns `false` for an invalid finish or one equal to the
current definition. The view decides whether a chunk needs rebuilding.

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
