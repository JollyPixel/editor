# VoxelDocument

The voxel data of a world, with no Three.js rendering objects: layers and
voxels, the block registry, the tileset declarations, undo/redo history, and
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
  readonly tilesets: TilesetList;   // declarations only, no atlases
  readonly materialGroups: MaterialGroupList;
  readonly history: VoxelHistory;   // see VoxelHistory.md
  readonly chunkSize: number;
  defaultTileSize: number | undefined;
}
```

`tilesets` holds only what a tileset *is*. The atlas textures built from those
declarations belong to the view's
[`TilesetManager`](../tilesets/TilesetManager.md).

`materialGroups` holds the [surface finishes](../materials/MaterialGroup.md)
that travel with the map.

## Events

```ts
type VoxelDocumentEvents = {
  command: (command: VoxelCommand, context: VoxelCommandContext) => void;
  loaded: () => void;
};
```

- `command` carries every edit, with `origin` `"local"` for a change made here
  and `"remote"` for one replayed through `apply()`. This is the stream a sync
  client broadcasts. See [commands](./commands.md).
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
resizeTileset(tilesetId: string, tileSize: number): boolean;

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
landed on, and a `material-group-defined` group has every field filled in.

`addTileset()` broadcasts a command. A tileset that arrives with its texture
rather than through an edit is declared with
[`VoxelView.loadTileset()`](./VoxelView.md), which adds it to `tilesets`
without a command.

`defineMaterialGroup()` adds or replaces a group and broadcasts it with every
field filled in. It returns `false` for an invalid finish or one equal to the
current definition. The view decides whether a chunk needs rebuilding.

`load()` replaces the world, drops the undo history, and emits `loaded`. The
snapshot replaces the tileset list and the material groups wholesale, so `options.tilesets`
declarations are applied after it:

```ts
interface VoxelLoadOptions {
  /** Collapses layers; higher-priority voxels win overlaps. */
  mergeLayers?: boolean;
  /** Declared after the snapshot replaced the list. */
  tilesets?: Iterable<TilesetDefinition>;
}
```
