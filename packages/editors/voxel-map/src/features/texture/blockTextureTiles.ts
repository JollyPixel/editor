// Import Third-party Dependencies
import {
  resolvedBlockTextureSlots,
  type BlockShape,
  type ResolvedBlockDefinition,
  type ResolvedTileRef,
  type ShapeTextureBounds
} from "@jolly-pixel/voxel.renderer";
import type {
  SelectionRect,
  UVGeometry
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  blockShapeUv,
  uvGeometryForSlot
} from "./blockShapeUv.ts";

export interface BlockTextureRects {
  block: ResolvedBlockDefinition;
  rects: SelectionRect[];
  geometries: UVGeometry[];
}

function textureRectOf(
  ref: ResolvedTileRef,
  bounds: ShapeTextureBounds,
  tileSize: number
): SelectionRect {
  return {
    x: (ref.col + bounds.u0) * tileSize,
    y: (ref.row + (1 - bounds.v1)) * tileSize,
    width: (bounds.u1 - bounds.u0) * tileSize,
    height: (bounds.v1 - bounds.v0) * tileSize
  };
}

export function findBlocksReferencingTileset(
  blocks: Iterable<ResolvedBlockDefinition>,
  shapeOf: (shapeId: string) => BlockShape | undefined,
  tilesetId: string,
  tileSize: number
): BlockTextureRects[] {
  const results: BlockTextureRects[] = [];
  for (const block of blocks) {
    const shape = shapeOf(block.shapeId);
    if (!shape) {
      continue;
    }

    const unique = new Map<string, SelectionRect>();
    const shapeUv = blockShapeUv(shape);
    const geometries: UVGeometry[] = [];
    for (const { slot, tile, bounds } of resolvedBlockTextureSlots(block, shape)) {
      if (tile.tilesetId !== tilesetId) {
        continue;
      }
      const rect = textureRectOf(tile, bounds, tileSize);
      const key = `${rect.x}:${rect.y}:${rect.width}:${rect.height}`;
      if (!unique.has(key)) {
        unique.set(key, rect);
      }
      geometries.push(uvGeometryForSlot(rect, shapeUv, slot));
    }
    if (unique.size > 0) {
      results.push({ block, rects: [...unique.values()], geometries });
    }
  }

  return results;
}
