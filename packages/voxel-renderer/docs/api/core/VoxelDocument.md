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
  readonly history: VoxelHistory;   // see VoxelHistory.md
  readonly chunkSize: number;
  defaultTileSize: number | undefined;
}
```

`tilesets` holds only what a tileset *is*. The atlas textures built from those
declarations belong to the view's
[`TilesetManager`](../tilesets/TilesetManager.md).

## Events

```ts
type VoxelDocumentEvents = {
  command: (command: VoxelCommand, context: VoxelCommandContext) => void;
  loaded: () => void;
  invalidated: (invalidation: { reason: string; }) => void;
};
```

- `command` carries every edit, with `origin` `"local"` for a change made here
  and `"remote"` for one replayed through `apply()`. This is the stream a sync
  client broadcasts. See [commands](./commands.md).
- `invalidated` says that everything built from this document is out of date,
  which happens when a block definition or a tileset changes. A view marks
  every chunk dirty on it.
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
registerTileset(def: TilesetDefinition): boolean;

save(): VoxelWorldJSON;
load(data: VoxelWorldJSON, options?: VoxelLoadOptions): void;
dispose(): void;
```

`apply()` returns `false` when the command changed nothing, and emits no event
in that case. A rejected command is never broadcast.

`addTileset()` broadcasts a command; `registerTileset()` does not. Use
`registerTileset()` for a tileset that arrives with its texture rather than
through an edit, which is what
[`VoxelView.loadTileset()`](./VoxelView.md) calls.

`load()` replaces the world, drops the undo history, and emits `loaded`. The
snapshot replaces the tileset list wholesale, so `options.tilesets`
declarations are applied after it:

```ts
interface VoxelLoadOptions {
  /** Collapses layers; higher-priority voxels win overlaps. */
  mergeLayers?: boolean;
  /** Declared after the snapshot replaced the list. */
  tilesets?: Iterable<TilesetDefinition>;
}
```
