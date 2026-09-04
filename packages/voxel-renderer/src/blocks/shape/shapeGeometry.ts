// Import Internal Dependencies
import {
  FACES,
  type FACE
} from "../../utils/math.ts";
import type { FaceDefinition } from "../face/index.ts";
import type { BlockShape } from "./BlockShape.ts";

export interface ShapeFaceRange {
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
   * One entry per face slot the shape uses, ordered by `FACE`.
   */
  ranges: readonly ShapeFaceRange[];
}

export function buildShapeGeometry(
  shape: BlockShape
): ShapeGeometry {
  const slots = groupBySlot(shape.faces);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const ranges: ShapeFaceRange[] = [];
  let vertex = 0;

  for (const slot of FACES) {
    const definitions = slots[slot];
    if (definitions === undefined) {
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
      count: vertex - start,
      definitions
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

function groupBySlot(
  faces: readonly FaceDefinition[]
): Partial<Record<FACE, FaceDefinition[]>> {
  const slots: Partial<Record<FACE, FaceDefinition[]>> = {};

  for (const definition of faces) {
    (slots[definition.face] ??= []).push(definition);
  }

  return slots;
}
