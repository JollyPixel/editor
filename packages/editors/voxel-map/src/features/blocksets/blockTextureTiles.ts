// Import Third-party Dependencies
import {
  BlockTextureLayout,
  resolveTileRect,
  type BlockShape,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";
import type {
  SelectionRect,
  UVGeometry
} from "@jolly-pixel/pixel-draw.renderer";
import {
  blockShapeUv,
  uvGeometryForSlot
} from "@jolly-pixel/asset.voxel-map/client";

export interface BlockTextureRects {
  block: ResolvedBlockDefinition;
  rects: SelectionRect[];
  geometries: UVGeometry[];
}

export function findBlocksReferencingBlockset(
  blocks: Iterable<ResolvedBlockDefinition>,
  resolveShape: (shapeId: string) => BlockShape | undefined,
  blocksetId: string,
  tileSize: number
): BlockTextureRects[] {
  return [...blocks].flatMap((block) => {
    const shape = resolveShape(block.shapeId);
    const layout = BlockTextureLayout.fromShape(block, shape);
    const slots = layout.slotsUsingBlockset(blocksetId);
    if (shape === undefined || slots.length === 0) {
      return [];
    }

    const shapeUv = blockShapeUv(shape);

    return [
      {
        block,
        rects: layout.collectDrawnTileRects(blocksetId, tileSize),
        geometries: slots.map(({ slot, tile, bounds, span }) => uvGeometryForSlot(
          resolveTileRect(tile, tileSize, bounds, span),
          shapeUv,
          slot
        ))
      }
    ];
  });
}
