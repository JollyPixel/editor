# TilesetDocument

The blocks, material groups and tile size of one tileset, with the command
stream that carries edits to them. A tileset document is what a shared
tileset asset holds beside its pixels; a world links the tileset and projects
the document's blocks into its own block ids through the tileset's
[slot](./tilesets.md#projecting-a-tileset-into-a-world).

Block ids are local to the document and start at `1`. Tile references name no
tileset: a defined block has the `tilesetId` stripped from every reference,
since they are all relative to the document's own atlas.

```ts
import { TilesetDocument } from "@jolly-pixel/voxel.renderer";

const tileset = new TilesetDocument({
  tileSize: 16,
  blocks: [
    { id: 1, name: "Grass", shapeId: "cube", defaultTexture: { col: 0, row: 0 } }
  ]
});

tileset.on("command", (command, { origin }) => {
  if (origin === "local") {
    room.send(command);
  }
});
tileset.defineMaterialGroup({ id: "gold", metalness: 1 });
```

## API

```ts
interface TilesetDocumentOptions {
  /** @default 32 */
  tileSize?: number;
  blocks?: Iterable<BlockDefinition>;
  materialGroups?: Iterable<MaterialGroupJSON>;
}

interface TilesetDocumentJSON {
  tileSize: number;
  blocks: ResolvedBlockDefinition[];
  materialGroups: MaterialGroupJSON[];
}

type TilesetDocumentEvents = {
  command: (command: TilesetDocumentCommand, context: VoxelCommandContext) => void;
  loaded: () => void;
};

class TilesetDocument extends Emitter<TilesetDocumentEvents> {
  readonly blocks: BlockRegistry;
  readonly materialGroups: MaterialGroupList;
  readonly tileSize: number;

  constructor(options?: TilesetDocumentOptions);

  apply(command: TilesetDocumentCommand, options?: { origin?: "local" | "remote"; }): boolean;

  defineBlock(def: BlockDefinition): boolean;
  defineBlocks(defs: Iterable<BlockDefinition>): void;
  removeBlock(blockId: number): boolean;
  moveBlock(blockId: number, toIndex: number): boolean;
  defineMaterialGroup(group: MaterialGroup | MaterialGroupJSON): boolean;
  removeMaterialGroup(groupId: string): boolean;
  resizeTiles(tileSize: number): boolean;

  toJSON(): TilesetDocumentJSON;
  load(data: TilesetDocumentJSON): void;
  clear(tileSize?: number): void;
  dispose(): void;
}

function localBlock(def: BlockDefinition): ResolvedBlockDefinition;
```

The constructor and `load()` throw `RangeError` for a tile size that fails
`isTileSize()`, and for any block `localBlock()` refuses. `load()` checks
every block before changing anything, so a failed load leaves the document
as it was.

`localBlock()` throws `RangeError` when the block id is outside
`1..MAX_LOCAL_BLOCK_ID` or the block itself is invalid; otherwise it returns
the resolved block with no tileset id in its references.

`apply()` folds a [tileset document command](../core/commands.md#world-and-tileset-document-commands)
and emits it under `origin` (default `"local"`) when it changed something;
it returns `false` and emits nothing otherwise. A `block-defined` command is
applied through `localBlock()`, so a definition arriving from a peer with
tileset ids in its references is stored without them. The shorthands build
the matching command: `defineBlock()` registers or replaces a block,
`moveBlock()` reorders one, `defineMaterialGroup()` adds or replaces a group
with every finish field filled in.

`resizeTiles()` changes the tile grid and rescales every block with
[`rescaleTileRef()`](./tilesets.md#rescaling-and-tile-rectangles) so it keeps
covering the same pixels; it emits `tile-size-updated`.

`toJSON()` writes the blocks in registry order. `load()` replaces the tile
size, blocks and material groups wholesale and emits `loaded`; `clear()`
loads an empty document with the given tile size (default
`DEFAULT_TILE_SIZE`).
