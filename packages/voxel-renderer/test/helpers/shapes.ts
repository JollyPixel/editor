// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { FaceDefinition } from "../../src/blocks/BlockShape.ts";

/**
 * Asserts every face normal of `faces` has a magnitude of 1.
 */
export function checkNormalMagnitudes(
  shapeName: string,
  faces: readonly FaceDefinition[]
): void {
  for (let i = 0; i < faces.length; i++) {
    const { normal } = faces[i];
    const mag = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2);
    assert.ok(
      Math.abs(mag - 1.0) < 1e-9,
      `${shapeName} face[${i}] normal magnitude is ${mag}, expected 1.0`
    );
  }
}

/**
 * Asserts every face of `faces` is a triangle or a quad.
 */
export function checkVertexCounts(
  shapeName: string,
  faces: readonly FaceDefinition[]
): void {
  for (let i = 0; i < faces.length; i++) {
    const count = faces[i].vertices.length;
    assert.ok(
      count === 3 || count === 4,
      `${shapeName} face[${i}] has ${count} vertices, expected 3 or 4`
    );
  }
}
