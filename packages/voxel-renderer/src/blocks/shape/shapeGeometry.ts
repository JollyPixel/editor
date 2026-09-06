// Import Internal Dependencies
import type { FACE } from "../../utils/math.ts";
import type { FaceDefinition } from "../face/index.ts";
import type { BlockShape } from "./BlockShape.ts";
import { shapeSlots } from "./shapeSlots.ts";

export interface ShapeFaceRange {
  /**
   * Texture slot the range's vertices sample.
   */
  slot: string;
  face: FACE;
  start: number;
  count: number;
  /**
   * Polygons the slot emitted, in the order their vertices were written.
   */
  definitions: readonly FaceDefinition[];
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
   * One entry per slot the shape uses, ordered by `FACE`.
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

  for (const slot of shapeSlots(shape)) {
    const start = vertex;

    for (const definition of slot.definitions) {
      const {
        vertices,
        normal,
        uvs: faceUvs
      } = definition;

      for (let corner = 0; corner < vertices.length; corner++) {
        const [x, y, z] = vertices[corner];
        const [u, v] = faceUvs[corner];

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
      slot: slot.id,
      face: slot.face,
      start,
      count: vertex - start,
      definitions: slot.definitions
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
