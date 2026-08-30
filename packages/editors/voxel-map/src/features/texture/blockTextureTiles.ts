// Import Third-party Dependencies
import type {
  ResolvedBlockDefinition,
  ResolvedTileRef
} from "@jolly-pixel/voxel.renderer";
import type { SelectionRect } from "@jolly-pixel/pixel-draw.renderer";

export interface BlockTextureRects {
  block: ResolvedBlockDefinition;
  rects: SelectionRect[];
}

function tileRectOf(
  ref: ResolvedTileRef,
  tileSize: number
): SelectionRect {
  return {
    x: ref.col * tileSize,
    y: ref.row * tileSize,
    width: tileSize,
    height: tileSize
  };
}

export function findBlocksReferencingTileset(
  blocks: Iterable<ResolvedBlockDefinition>,
  tilesetId: string,
  tileSize: number
): BlockTextureRects[] {
  const results: BlockTextureRects[] = [];

  for (const block of blocks) {
    const refs: ResolvedTileRef[] = [];
    if (block.defaultTexture?.tilesetId === tilesetId) {
      refs.push(block.defaultTexture);
    }
    for (const ref of Object.values(block.faceTextures)) {
      if (ref?.tilesetId === tilesetId) {
        refs.push(ref);
      }
    }

    if (refs.length > 0) {
      results.push({
        block,
        rects: refs.map((ref) => tileRectOf(ref, tileSize))
      });
    }
  }

  return results;
}
