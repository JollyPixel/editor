// Import Internal Dependencies
import { FACE } from "../utils/math.ts";
import type { BlockShape } from "./BlockShape.ts";

// CONSTANTS
const kFaceOrder: readonly FACE[] = [
  FACE.PosX,
  FACE.NegX,
  FACE.PosY,
  FACE.NegY,
  FACE.PosZ,
  FACE.NegZ
];

export interface ShapeFaceRange {
  face: FACE;
  start: number;
  count: number;
}

export interface ShapeGeometry {
  /**
   * Three floats per vertex in normalized block space, so `0` to `1`.
   */
  positions: Float32Array;
  normals: Float32Array;
  /**
   * Two floats per vertex in normalized tile space, before any atlas mapping.
   */
  uvs: Float32Array;
  indices: Uint16Array;
  /**
   * One entry per face slot the shape uses, ordered by `FACE`.
   */
  ranges: readonly ShapeFaceRange[];
}

export function buildShapeGeometry(
  shape: BlockShape
): ShapeGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const ranges: ShapeFaceRange[] = [];
  let vertex = 0;

  for (const slot of kFaceOrder) {
    const definitions = shape.faces.filter(
      (definition) => definition.face === slot
    );
    if (definitions.length === 0) {
      continue;
    }

    const start = vertex;
    for (const { vertices, uvs: faceUvs, normal } of definitions) {
      for (let index = 0; index < vertices.length; index++) {
        const [x, y, z] = vertices[index];
        const [u, v] = faceUvs[index];

        positions.push(x, y, z);
        normals.push(normal[0], normal[1], normal[2]);
        uvs.push(u, v);
      }

      for (let corner = 1; corner < vertices.length - 1; corner++) {
        indices.push(vertex, vertex + corner, vertex + corner + 1);
      }
      vertex += vertices.length;
    }

    ranges.push({
      face: slot,
      start,
      count: vertex - start
    });
  }

  return {
    positions: Float32Array.from(positions),
    normals: Float32Array.from(normals),
    uvs: Float32Array.from(uvs),
    indices: Uint16Array.from(indices),
    ranges
  };
}

export function shapeFaceRange(
  geometry: ShapeGeometry,
  face: FACE
): ShapeFaceRange | undefined {
  return geometry.ranges.find(
    (range) => range.face === face
  );
}
