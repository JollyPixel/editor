// Import Third-party Dependencies
import * as THREE from "three";
import type { BlockShape } from "@jolly-pixel/voxel.renderer";

// CONSTANTS
const kPoleColumns = 5;
const kPoleOffset = 7;

export interface Placement {
  shape: BlockShape;
  family: string;
  col: number;
  row: number;
}

export function placeShapes(
  shapes: Iterable<BlockShape>
): Placement[] {
  const rows: string[] = [];
  const counts = new Map<string, number>();

  return Array.from(shapes, (shape) => {
    const family = /^[a-z]+/u.exec(shape.id)![0];
    const group = family === "cube" ? "slab" : family;
    const index = counts.get(group) ?? 0;
    counts.set(group, index + 1);

    if (group === "pole") {
      return {
        shape,
        family,
        col: kPoleOffset + (index % kPoleColumns),
        row: Math.floor(index / kPoleColumns)
      };
    }
    if (!rows.includes(group)) {
      rows.push(group);
    }

    return {
      shape,
      family,
      col: index,
      row: rows.indexOf(group)
    };
  });
}

export function shapeGeometry(
  shape: BlockShape
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];

  for (const { vertices, normal } of shape.faces) {
    const indices = vertices.length === 3 ?
      [0, 1, 2] :
      [0, 1, 2, 0, 2, 3];

    for (const index of indices) {
      positions.push(...vertices[index]);
      normals.push(...normal);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));

  return geometry;
}
