// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { createModelGrid } from "#src/scene/modelGrid.ts";

function box(
  min: [number, number, number],
  max: [number, number, number]
): THREE.Box3 {
  return new THREE.Box3(
    new THREE.Vector3(...min),
    new THREE.Vector3(...max)
  );
}

describe("createModelGrid", () => {
  test("scales its cells and extent with the model footprint", () => {
    const grids = [
      createModelGrid(box([-0.5, 0, -0.5], [0.5, 1, 0.5])),
      createModelGrid(box([-60, 0, -20], [40, 180, 20]))
    ];

    assert.deepEqual(
      grids.map((grid) => [grid.cellSize, grid.extent]),
      [[0.1, 3], [10, 400]]
    );
  });

  test("sits under a model that reaches below the ground", () => {
    const grid = createModelGrid(box([-1, -2, -1], [1, 2, 1]));

    assert.equal(grid.offset, -2);
  });
});
