// Import Internal Dependencies
import type { FACE } from "../../utils/math.ts";
import type { FaceDefinition } from "../face/index.ts";
import type { BlockShape } from "./BlockShape.ts";
import { shapeSlots } from "./shapeSlots.ts";
import { VoxelTransform } from "../../world/VoxelTransform.ts";
import {
  rotateNormal,
  rotateVertex
} from "../../mesh/variants/rotation.ts";

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
  shape: BlockShape,
  transform: VoxelTransform = VoxelTransform.Identity
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
      const [nx, ny, nz] = rotateNormal(normal, transform);

      for (let corner = 0; corner < vertices.length; corner++) {
        const source = transform.flipY ?
          vertices.length - 1 - corner :
          corner;
        const [x, y, z] = rotateVertex(vertices[source], transform);
        const [u, v] = faceUvs[source];

        positions.push(x, y, z);
        normals.push(nx, ny, nz);
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
