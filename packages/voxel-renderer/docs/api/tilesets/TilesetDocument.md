# TilesetDocument

The blocks, material groups, blend groups and tile size of one tileset, with
the command stream that carries edits to them. Block ids start at `1` and are
local to the document; tile references name no tileset. A
[`TilesetLink`](./TilesetLink.md) projects the document into a world.

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

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `tileSize` | `number` | `DEFAULT_TILE_SIZE` (32) | Tile side in pixels, from 1 to `MAX_TILE_SIZE`. |
| `blocks` | `Iterable<BlockDefinition>` | `[]` | Tileset-local ids; tileset ids in tile references are dropped. |
| `materialGroups` | `Iterable<MaterialGroupJSON>` | `[]` | See [`MaterialGroup`](../materials/MaterialGroup.md). |
| `blendGroups` | `Iterable<BlendGroupJSON>` | `[]` | See [`BlendGroup`](../materials/BlendGroup.md). |

The constructor throws a `RangeError` for an invalid tile size and for any
block `localBlock()` refuses.

## Shared with VoxelDocument

`blocks`, `materialGroups`, `blendGroups`, `apply()`, `defineBlock()`,
`defineBlocks()`, `removeBlock()`, `moveBlock()`, `defineMaterialGroup()`,
`removeMaterialGroup()`, `defineBlendGroup()` and `removeBlendGroup()` behave
as on [`VoxelDocument`](../core/VoxelDocument.md). A block defined here, or
received from a peer, has the tileset id stripped from its tile references.

## Members

#### `tileSize: number`

#### `resizeTiles(tileSize: number): boolean`

Changes the tile grid and rescales every block's tile references so they cover
the same pixels. Emits `"tile-size-updated"`.

#### `toJSON(): TilesetDocumentJSON`

```ts
interface TilesetDocumentJSON {
  tileSize: number;
  blocks: ResolvedBlockDefinition[];
  materialGroups: MaterialGroupJSON[];
  blendGroups?: BlendGroupJSON[]; // read as [] when missing
}
```

Blocks are written in registry order.

#### `load(data: TilesetDocumentJSON): void`

Replaces everything and emits `"loaded"`. Throws a `RangeError` for an invalid
tile size or block, and leaves the document unchanged when it does.

#### `clear(tileSize?: number): void`

Loads an empty document. `tileSize` defaults to `DEFAULT_TILE_SIZE`.

#### `dispose(): void`

Removes every listener.

#### `localBlock(def: BlockDefinition): ResolvedBlockDefinition`

A standalone function. Resolves a block and strips the tileset id from its
tile references. Throws a `RangeError` for an id outside
`1..MAX_LOCAL_BLOCK_ID` or an invalid block.

## Events

| Event | Arguments | When |
| --- | --- | --- |
| `command` | `command: TilesetDocumentCommand`, `context: { origin }` | After every change. `TilesetDocumentListener` is the listener type. |
| `loaded` | | After `load()` and `clear()`. |

The commands are listed in [commands](../core/commands.md).
