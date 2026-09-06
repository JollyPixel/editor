// Import Third-party Dependencies
import {
  shapeTextureLayout,
  type BlockShape,
  type ShapeTextureBounds,
  type ShapeTexturePart
} from "@jolly-pixel/voxel.renderer";
import type {
  SelectionRect,
  UVCompoundPart,
  UVGeometry,
  UVSlot,
  UVTriangleCorner
} from "@jolly-pixel/pixel-draw.renderer";
import type { FaceRanges } from "@jolly-pixel/editor.pixel-art/mesh-texturing/types.ts";

export type UVSlotBounds = ShapeTextureBounds;

export interface BlockShapeUv {
  activeFaces: UVSlot[];
  bounds: Partial<Record<UVSlot, UVSlotBounds>>;
  triangles: Partial<Record<UVSlot, UVTriangleCorner>>;
  parts: Partial<Record<UVSlot, UVCompoundPart[]>>;
  faceRanges: FaceRanges;
  isBox: boolean;
}

/**
 * Adapts renderer-owned texture topology into pixel-editor UV geometry.
 */
export function blockShapeUv(shape: BlockShape): BlockShapeUv {
  const layout = shapeTextureLayout(shape);
  const activeFaces: UVSlot[] = [];
  const bounds: Partial<Record<UVSlot, UVSlotBounds>> = {};
  const triangles: Partial<Record<UVSlot, UVTriangleCorner>> = {};
  const parts: Partial<Record<UVSlot, UVCompoundPart[]>> = {};
  const faceRanges: FaceRanges = {};

  for (const entry of layout.slots) {
    const slot = entry.slot;
    activeFaces.push(slot);
    bounds[slot] = entry.bounds;
    faceRanges[slot] = [{ start: entry.start, count: entry.count }];

    if (entry.parts.length > 1) {
      parts[slot] = entry.parts.map((part) => normalizedPart(part, entry.bounds));
    }
    else if (entry.parts[0]?.corner !== null) {
      triangles[slot] = entry.parts[0].corner;
    }
  }

  return { activeFaces, bounds, triangles, parts, faceRanges, isBox: layout.isBox };
}

export function uvGeometryForSlot(
  rect: SelectionRect,
  shapeUv: BlockShapeUv,
  slot: UVSlot
): UVGeometry {
  const parts = shapeUv.parts[slot];
  if (parts) {
    return { shape: "compound", rect, parts };
  }
  const corner = shapeUv.triangles[slot];

  return corner ? { shape: "triangle", corner, rect } : rect;
}

function normalizedPart(
  part: ShapeTexturePart,
  slot: ShapeTextureBounds
): UVCompoundPart {
  const width = slot.u1 - slot.u0 || 1;
  const height = slot.v1 - slot.v0 || 1;
  const rect = {
    x: (part.bounds.u0 - slot.u0) / width,
    y: (slot.v1 - part.bounds.v1) / height,
    width: (part.bounds.u1 - part.bounds.u0) / width,
    height: (part.bounds.v1 - part.bounds.v0) / height
  };

  return part.corner === null ? rect : {
    shape: "triangle",
    corner: part.corner,
    rect
  };
}
