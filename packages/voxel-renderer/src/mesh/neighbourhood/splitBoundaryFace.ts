// Import Internal Dependencies
import type { BlockVariantFace } from "../variants/types.ts";

// CONSTANTS
const kEpsilon = 1e-7;

interface Vertex {
  position: number[];
  uv: number[];
  tileUv: number[];
}

interface SplitBoundaryOptions {
  face: BlockVariantFace;
  neighbour: BlockVariantFace;
  frontSlot: number;
  remove: boolean;
}

export function splitBoundaryFace(
  options: SplitBoundaryOptions
): BlockVariantFace[] {
  const { face, neighbour, frontSlot, remove } = options;

  const axis = face.cull >> 1;
  const uAxis = (axis + 1) % 3;
  const vAxis = (axis + 2) % 3;
  const clip = verticesOf(neighbour);

  let area = 0;
  for (let vertexIndex = 0; vertexIndex < clip.length; vertexIndex++) {
    const start = clip[vertexIndex].position;
    const end = clip[(vertexIndex + 1) % clip.length].position;
    area += start[uAxis] * end[vAxis] - end[uAxis] * start[vAxis];
  }

  const sign = Math.sign(area);
  let inside = verticesOf(face);
  const outside: Vertex[][] = [];
  for (let vertexIndex = 0; vertexIndex < clip.length && inside.length >= 3; vertexIndex++) {
    const start = clip[vertexIndex].position;
    const end = clip[(vertexIndex + 1) % clip.length].position;
    function distance(vertex: Vertex): number {
      return sign * (
        (end[uAxis] - start[uAxis]) * (vertex.position[vAxis] - start[vAxis]) -
        (end[vAxis] - start[vAxis]) * (vertex.position[uAxis] - start[uAxis])
      );
    }

    const [kept, rejected] = splitPolygon(inside, distance);
    if (rejected.length >= 3) {
      outside.push(rejected);
    }
    inside = kept;
  }

  if (!hasArea(inside, uAxis, vAxis)) {
    return [face];
  }
  if (outside.every((polygon) => !hasArea(polygon, uAxis, vAxis))) {
    return remove ? [] : [{ ...face, slot: frontSlot }];
  }
  const result = outside.flatMap((polygon) => (
    hasArea(polygon, uAxis, vAxis) ? triangulate(face, polygon, face.slot) : []
  ));
  if (!remove) {
    result.push(...triangulate(face, inside, frontSlot));
  }

  return result;
}

function verticesOf(
  face: BlockVariantFace
): Vertex[] {
  return Array.from({ length: face.vertexCount }, (_, vertexIndex) => {
    return {
      position: Array.from(face.positions.slice(vertexIndex * 3, vertexIndex * 3 + 3)),
      uv: Array.from(face.uvs.slice(vertexIndex * 2, vertexIndex * 2 + 2)),
      tileUv: Array.from(face.tileUvs.slice(vertexIndex * 2, vertexIndex * 2 + 2))
    };
  });
}

function splitPolygon(
  polygon: Vertex[],
  distance: (vertex: Vertex) => number
): [Vertex[], Vertex[]] {
  const inside: Vertex[] = [];
  const outside: Vertex[] = [];

  for (let vertexIndex = 0; vertexIndex < polygon.length; vertexIndex++) {
    const start = polygon[vertexIndex];
    const end = polygon[(vertexIndex + 1) % polygon.length];
    const startDistance = distance(start);
    const endDistance = distance(end);

    if (startDistance >= -kEpsilon) {
      inside.push(start);
    }
    if (startDistance <= kEpsilon) {
      outside.push(start);
    }
    if ((startDistance > kEpsilon && endDistance < -kEpsilon) ||
      (startDistance < -kEpsilon && endDistance > kEpsilon)) {
      const fraction = startDistance / (startDistance - endDistance);
      function interpolate(values: number[], other: number[]): number[] {
        return values.map((value, componentIndex) => value + (other[componentIndex] - value) * fraction);
      }
      const intersection = {
        position: interpolate(start.position, end.position),
        uv: interpolate(start.uv, end.uv),
        tileUv: interpolate(start.tileUv, end.tileUv)
      };
      inside.push(intersection);
      outside.push(intersection);
    }
  }

  return [inside, outside];
}

function hasArea(
  polygon: Vertex[],
  uAxis: number,
  vAxis: number
): boolean {
  let area = 0;
  for (let vertexIndex = 0; vertexIndex < polygon.length; vertexIndex++) {
    const start = polygon[vertexIndex].position;
    const end = polygon[(vertexIndex + 1) % polygon.length].position;
    area += start[uAxis] * end[vAxis] - end[uAxis] * start[vAxis];
  }

  return Math.abs(area) > kEpsilon;
}

function triangulate(
  face: BlockVariantFace,
  polygon: Vertex[],
  slot: number
): BlockVariantFace[] {
  const result: BlockVariantFace[] = [];

  for (let vertexIndex = 1; vertexIndex < polygon.length - 1; vertexIndex++) {
    const triangle = [
      polygon[0],
      polygon[vertexIndex],
      polygon[vertexIndex + 1]
    ];

    result.push({
      ...face,
      slot,
      vertexCount: 3,
      indexCount: 3,
      positions: new Float32Array(
        triangle.flatMap((vertex) => vertex.position)
      ),
      uvs: new Uint16Array(
        triangle.flatMap((vertex) => vertex.uv.map(Math.round))
      ),
      tileUvs: new Float32Array(
        triangle.flatMap((vertex) => vertex.tileUv)
      ),
      merge: null
    });
  }

  return result;
}
