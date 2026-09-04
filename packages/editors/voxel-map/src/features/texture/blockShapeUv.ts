// Import Third-party Dependencies
import {
  Face,
  buildShapeGeometry,
  type BlockShape,
  type FaceDefinition,
  type ShapeGeometry
} from "@jolly-pixel/voxel.renderer";
import {
  UV_FACES,
  type UVFace,
  type UVTriangleCorner
} from "@jolly-pixel/pixel-draw.renderer";
import type { FaceRanges } from "@jolly-pixel/editor.pixel-art/three/types.ts";

// CONSTANTS
export const UV_FACE_TO_VOXEL: Record<UVFace, Face> = {
  front: Face.PosZ,
  back: Face.NegZ,
  left: Face.NegX,
  right: Face.PosX,
  top: Face.PosY,
  bottom: Face.NegY
};

const kVoxelFaceToUv = new Map<Face, UVFace>(
  UV_FACES.map((face) => [UV_FACE_TO_VOXEL[face], face])
);

const kEpsilon = 1e-6;

export interface UVFaceBounds {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export interface BlockShapeUv {
  /**
   * Face slots the shape actually emits geometry for.
   */
  activeFaces: UVFace[];
  /**
   * Tile footprint of each active slot, the union when it holds several
   * polygons.
   */
  bounds: Partial<Record<UVFace, UVFaceBounds>>;
  /**
   * Faces drawn as a triangle in the 2D editor, with their right-angle corner.
   */
  triangles: Partial<Record<UVFace, UVTriangleCorner>>;
  /**
   * Vertex ranges into `buildShapeGeometry(shape)`, keyed by UV face.
   */
  faceRanges: FaceRanges;
  /**
   * True when the shape is a plain six-face box, which may collapse to a
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
  const faceRanges: FaceRanges = {};
  let everySlotIsOneFullQuad = true;

  for (const range of geometry.ranges) {
    const face = kVoxelFaceToUv.get(range.face);
    if (face === undefined) {
      continue;
    }

    const { definitions } = range;
    const slotBounds = boundsOf(geometry, range.start, range.count);

    activeFaces.push(face);
    bounds[face] = slotBounds;
    faceRanges[face] = [
      {
        start: range.start,
        count: range.count
      }
    ];

    const corner = triangleCornerOf(definitions, slotBounds);
    if (corner !== null) {
      triangles[face] = corner;
    }

    if (definitions.length > 1 || !coversTile(slotBounds)) {
      everySlotIsOneFullQuad = false;
    }
  }

  return {
    activeFaces: UV_FACES.filter((face) => activeFaces.includes(face)),
    bounds,
    triangles,
    faceRanges,
    isBox: activeFaces.length === UV_FACES.length &&
      Object.keys(triangles).length === 0 &&
      everySlotIsOneFullQuad
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

function triangleCornerOf(
  definitions: readonly FaceDefinition[],
  bounds: UVFaceBounds
): UVTriangleCorner | null {
  if (definitions.length === 0) {
    return null;
  }

  const corners = definitions.map(
    (definition) => rightAngleCorner(definition, bounds)
  );

  return corners.every((corner) => corner !== null && corner === corners[0]) ?
    corners[0] :
    null;
}

function rightAngleCorner(
  definition: FaceDefinition,
  bounds: UVFaceBounds
): UVTriangleCorner | null {
  const { uvs } = definition;
  if (uvs.length !== 3) {
    return null;
  }

  for (let index = 0; index < 3; index++) {
    const [u, v] = uvs[index];
    const [firstU, firstV] = uvs[(index + 1) % 3];
    const [secondU, secondV] = uvs[(index + 2) % 3];
    const isRightAngle =
      (firstU === u && secondV === v) ||
      (secondU === u && firstV === v);

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
