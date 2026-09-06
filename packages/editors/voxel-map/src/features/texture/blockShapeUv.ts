// Import Third-party Dependencies
import {
  Face,
  baseSlotOf,
  buildShapeGeometry,
  type BlockShape,
  type ShapeGeometry
} from "@jolly-pixel/voxel.renderer";
import {
  UV_FACES,
  type UVCompoundPart,
  type UVFace,
  type UVTriangleCorner
} from "@jolly-pixel/pixel-draw.renderer";
import type { FaceRanges } from "@jolly-pixel/editor.pixel-art/three/types.ts";

// CONSTANTS
const kEpsilon = 1e-6;
const kBoxSlots: readonly UVFace[] = UV_FACES;

export const UV_FACE_TO_VOXEL: Record<UVFace, Face> = {
  front: Face.PosZ,
  back: Face.NegZ,
  left: Face.NegX,
  right: Face.PosX,
  top: Face.PosY,
  bottom: Face.NegY
};

export interface UVFaceBounds {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export interface BlockShapeUv {
  /**
   * Texture slots the shape emits geometry for, in the shape's own order.
   */
  activeFaces: UVFace[];
  /**
   * Tile footprint of each slot, the union when it holds several polygons.
   */
  bounds: Partial<Record<UVFace, UVFaceBounds>>;
  /**
   * Slots drawn as a triangle in the 2D editor, with their right-angle corner.
   */
  triangles: Partial<Record<UVFace, UVTriangleCorner>>;
  /**
   * Polygons of a slot holding several of them, in the `0` to `1` space of
   * that slot's bounds. A slot's true coverage, such as the L of a stair side.
   */
  parts: Partial<Record<UVFace, UVCompoundPart[]>>;
  /**
   * Vertex ranges into `buildShapeGeometry(shape)`, keyed by slot.
   */
  faceRanges: FaceRanges;
  /**
   * True when the shape is a plain six-slot box, which may collapse to a
   * single shared rectangle.
   */
  isBox: boolean;
}

export function blockShapeUv(
  shape: BlockShape
): BlockShapeUv {
  const geometry = buildShapeGeometry(shape);
  const activeFaces: UVFace[] = [];
  const bounds: Partial<Record<UVFace, UVFaceBounds>> = {};
  const triangles: Partial<Record<UVFace, UVTriangleCorner>> = {};
  const parts: Partial<Record<UVFace, UVCompoundPart[]>> = {};
  const faceRanges: FaceRanges = {};
  let everySlotIsOneFullQuad = true;

  for (const range of geometry.ranges) {
    const slot = range.slot;
    const slotBounds = boundsOf(geometry, range.start, range.count);

    activeFaces.push(slot);
    bounds[slot] = slotBounds;
    faceRanges[slot] = [
      {
        start: range.start,
        count: range.count
      }
    ];

    const polygons = polygonsOf(geometry, range.start, range.definitions);
    if (polygons.length > 1) {
      parts[slot] = polygons.map(
        (polygon) => partOf(polygon, slotBounds)
      );
      everySlotIsOneFullQuad = false;
      continue;
    }

    const [only] = polygons;
    if (only.corner !== null) {
      triangles[slot] = only.corner;
    }
    if (only.corner !== null || !coversTile(slotBounds)) {
      everySlotIsOneFullQuad = false;
    }
  }

  return {
    activeFaces: orderSlots(activeFaces),
    bounds,
    triangles,
    parts,
    faceRanges,
    isBox: activeFaces.length === kBoxSlots.length &&
      kBoxSlots.every((slot) => activeFaces.includes(slot)) &&
      everySlotIsOneFullQuad
  };
}

function orderSlots(
  slots: readonly UVFace[]
): UVFace[] {
  return [...slots].sort((a, b) => {
    const base = kBoxSlots.indexOf(baseSlotOf(a)) -
      kBoxSlots.indexOf(baseSlotOf(b));

    return base === 0 ? suffixOf(a) - suffixOf(b) : base;
  });
}

function suffixOf(
  slot: UVFace
): number {
  const separator = slot.indexOf(".");

  return separator === -1 ? 0 : Number(slot.slice(separator + 1));
}

interface SlotPolygon {
  bounds: UVFaceBounds;
  corner: UVTriangleCorner | null;
}

function polygonsOf(
  geometry: ShapeGeometry,
  start: number,
  definitions: readonly { vertices: readonly unknown[]; }[]
): SlotPolygon[] {
  const polygons: SlotPolygon[] = [];
  let cursor = start;

  for (const definition of definitions) {
    const count = definition.vertices.length;
    const polygonBounds = boundsOf(geometry, cursor, count);

    polygons.push({
      bounds: polygonBounds,
      corner: count === 3 ?
        rightAngleCorner(geometry, cursor, polygonBounds) :
        null
    });
    cursor += count;
  }

  return polygons;
}

function partOf(
  polygon: SlotPolygon,
  slot: UVFaceBounds
): UVCompoundPart {
  const width = slot.u1 - slot.u0 || 1;
  const height = slot.v1 - slot.v0 || 1;
  const rect = {
    x: (polygon.bounds.u0 - slot.u0) / width,
    y: (slot.v1 - polygon.bounds.v1) / height,
    width: (polygon.bounds.u1 - polygon.bounds.u0) / width,
    height: (polygon.bounds.v1 - polygon.bounds.v0) / height
  };

  return polygon.corner === null ?
    rect :
    {
      shape: "triangle",
      corner: polygon.corner,
      rect
    };
}

function boundsOf(
  geometry: ShapeGeometry,
  start: number,
  count: number
): UVFaceBounds {
  let u0 = Infinity;
  let v0 = Infinity;
  let u1 = -Infinity;
  let v1 = -Infinity;

  for (let index = start; index < start + count; index++) {
    const u = geometry.uvs[index * 2];
    const v = geometry.uvs[(index * 2) + 1];
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
    v0 = Math.min(v0, v);
    v1 = Math.max(v1, v);
  }

  return { u0, v0, u1, v1 };
}

function coversTile(
  bounds: UVFaceBounds
): boolean {
  return Math.abs(bounds.u0) < kEpsilon &&
    Math.abs(bounds.v0) < kEpsilon &&
    Math.abs(bounds.u1 - 1) < kEpsilon &&
    Math.abs(bounds.v1 - 1) < kEpsilon;
}

function rightAngleCorner(
  geometry: ShapeGeometry,
  start: number,
  bounds: UVFaceBounds
): UVTriangleCorner | null {
  const uvs: [number, number][] = [];
  for (let index = start; index < start + 3; index++) {
    uvs.push([
      geometry.uvs[index * 2],
      geometry.uvs[(index * 2) + 1]
    ]);
  }

  for (let index = 0; index < 3; index++) {
    const [u, v] = uvs[index];
    const [firstU, firstV] = uvs[(index + 1) % 3];
    const [secondU, secondV] = uvs[(index + 2) % 3];
    const isRightAngle =
      (near(firstU, u) && near(secondV, v)) ||
      (near(secondU, u) && near(firstV, v));

    if (isRightAngle) {
      const vertical = near(v, bounds.v1) ? "top" : "bottom";
      const horizontal = near(u, bounds.u1) ? "right" : "left";

      return `${vertical}-${horizontal}`;
    }
  }

  return null;
}

function near(
  value: number,
  target: number
): boolean {
  return Math.abs(value - target) < kEpsilon;
}
