# BlockPieces

Textured geometry of a single block, for thumbnails, a block under the cursor
or a template being placed. Tile rotation and the `$missing` blockset look the
same as in the world.

```ts
import { BlockPieces, VoxelTransform } from "@jolly-pixel/voxel.renderer";

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
  atlases: BlocksetAtlases;
  emptyTile?: EmptyTileProbe;
}

interface BlockPiece {
  readonly geometry: THREE.BufferGeometry;
  readonly texture: THREE.Texture | null;
  readonly surface: BlockSurface;
}

class BlockPieces {
  constructor(options: BlockPiecesOptions);

  pieceOf(
    block: ResolvedBlockDefinition,
    transform?: VoxelTransform
  ): BlockPiece | null;
  geometryOf(
    block: ResolvedBlockDefinition,
    transform?: VoxelTransform
  ): THREE.BufferGeometry | null;
  textureOf(block: ResolvedBlockDefinition): THREE.Texture | null;
  emptySlotsOf(block: ResolvedBlockDefinition): string[];
  clear(): void;
}
```

`geometryOf()` returns a new geometry in block space, `0` to `1`, with one
group per [texture slot](./BlockTextures.md#texture-slots). A slot whose tile
`emptyTile` reports empty uses material index `BLOCK_PIECE_EMPTY_GROUP`, the
others `BLOCK_PIECE_TEXTURED_GROUP`. Without a probe, only a slot with no tile
is empty. It returns `null` for an unknown shape, and the caller owns the
result.

`emptySlotsOf()` lists the slots `geometryOf()` puts in the empty group.

`textureOf()` returns the atlas texture of the blockset `defaultTexture` names,
or the `$missing` texture when that blockset is not declared.

`pieceOf()` caches one piece per block object and transform, and owns its
geometry: do not dispose or transform it. The cache empties when the atlases
change. `clear()` empties it and disposes the cached geometries.
