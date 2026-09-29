# BlockPieces

Textured single-block geometry for previews and ghosts: a library thumbnail,
a block under the cursor, a template being placed. Tile UVs go through the
chunk mesher's path, so tile rotation and the `$missing` fallback look the
same as in the world.

```ts
import { BlockPieces } from "@jolly-pixel/voxel.renderer";

const pieces = new BlockPieces({
  shapes: view.shapes,
  atlases: view.atlases
});
const piece = pieces.pieceOf(block, new VoxelTransform({ rotation: 1 }));
```

```ts
const BLOCK_PIECE_TEXTURED_GROUP = 0;
const BLOCK_PIECE_EMPTY_GROUP = 1;

type EmptyTileProbe = (
  ref: ResolvedTileRef | undefined,
  alphaCutoff: number
) => boolean;

interface BlockPiecesOptions {
  shapes: BlockShapeRegistry;
  atlases: TilesetAtlases;
  emptyTile?: EmptyTileProbe;
}

interface BlockPiece {
  readonly geometry: THREE.BufferGeometry;
  readonly texture: THREE.Texture | null;
  readonly surface: BlockSurface;
}

class BlockPieces {
  constructor(options: BlockPiecesOptions);

  pieceOf(block: ResolvedBlockDefinition, transform?: VoxelTransform): BlockPiece | null;
  geometryOf(block: ResolvedBlockDefinition, transform?: VoxelTransform): THREE.BufferGeometry | null;
  textureOf(block: ResolvedBlockDefinition): THREE.Texture | null;
  emptySlotsOf(block: ResolvedBlockDefinition): string[];
  clear(): void;
}
```

`geometryOf()` builds a new indexed geometry in block space, `0` to `1` on each
axis, with one group per [texture slot](./shapeSlots.md). A slot's group uses
material index `BLOCK_PIECE_EMPTY_GROUP` when `emptyTile` reports its tile as
empty, and `BLOCK_PIECE_TEXTURED_GROUP` otherwise. Without a probe, a slot with
no tile is the only empty one. It returns `null` for an unknown shape. The
caller owns the geometry.

`textureOf()` is the atlas texture of the block's default tileset, or the
`$missing` texture when that tileset is not declared.

`pieceOf()` caches a piece per block object and transform, and owns its
geometry: do not dispose or transform it. The cache empties when the atlases
change; `clear()` empties it and disposes every cached geometry.
