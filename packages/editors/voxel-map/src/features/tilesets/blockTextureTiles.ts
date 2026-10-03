// Import Third-party Dependencies
import {
  BlockTextureLayout,
  tileRectOf,
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

export function findBlocksReferencingTileset(
  blocks: Iterable<ResolvedBlockDefinition>,
  shapeOf: (shapeId: string) => BlockShape | undefined,
  tilesetId: string,
  tileSize: number
): BlockTextureRects[] {
  return [...blocks].flatMap((block) => {
    const shape = shapeOf(block.shapeId);
    const layout = BlockTextureLayout.of(block, shape);
    const slots = layout.slotsIn(tilesetId);
    if (shape === undefined || slots.length === 0) {
      return [];
    }

    const shapeUv = blockShapeUv(shape);

    return [
      {
        block,
        rects: layout.drawnRectsIn(tilesetId, tileSize),
        geometries: slots.map(({ slot, tile, bounds, span }) => uvGeometryForSlot(
          tileRectOf(tile, tileSize, bounds, span),
          shapeUv,
          slot
        ))
      }
    ];
  });
}
