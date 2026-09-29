// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { VoxelSolid } from "../../../../src/features/painting/model/VoxelSolid.ts";
import { VoxelShell } from "../../../../src/features/painting/model/VoxelShell.ts";
import { BrushFootprint } from "../../../../src/features/painting/model/BrushFootprint.ts";

function segmentsOf(
  edges: number[]
): string[] {
  const segments: string[] = [];
  for (let index = 0; index < edges.length; index += 6) {
    segments.push(edges.slice(index, index + 6).join(","));
  }

  return segments.sort();
}

function lengthOf(
  edges: number[]
): number {
  let length = 0;
  for (let index = 0; index < edges.length; index += 6) {
    length += Math.hypot(
      edges[index + 3] - edges[index],
      edges[index + 4] - edges[index + 1],
      edges[index + 5] - edges[index + 2]
    );
  }

  return length;
}

describe("VoxelSolid.contour", () => {
  const cube = [{ x: 0, y: 0, z: 0 }];

  test("keeps the hexagon around a cube seen from a corner", () => {
    const edges = VoxelSolid.of(cube).contour(VoxelShell.of(cube), [5, 5, 5]);

    assert.deepStrictEqual(segmentsOf(edges), [
      "0,0,1,0,1,1",
      "0,0,1,1,0,1",
      "0,1,0,0,1,1",
      "0,1,0,1,1,0",
      "1,0,0,1,0,1",
      "1,0,0,1,1,0"
    ]);
  });

  test("keeps the four edges of the only face seen head-on", () => {
    const edges = VoxelSolid.of(cube).contour(VoxelShell.of(cube), [0.5, 5, 0.5]);

    assert.deepStrictEqual(segmentsOf(edges), [
      "0,1,0,0,1,1",
      "0,1,0,1,1,0",
      "0,1,1,1,1,1",
      "1,1,0,1,1,1"
    ]);
  });

  test("drops a step edge drawn over the step below it", () => {
    const stair = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 }
    ];
    const shell = VoxelShell.of(stair);
    const eye = [4, 10, 0.5];
    const step = "1,2,0,1,2,1";

    assert.ok(segmentsOf(shell.edgesFacing(eye)).includes(step));
    assert.ok(
      !segmentsOf(VoxelSolid.of(stair).contour(shell, eye)).includes(step)
    );
  });

  test("keeps the part of an edge that sticks out of a nearer cell", () => {
    const cells = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 2 },
      { x: 0, y: 0, z: 3 },
      { x: 3, y: 0, z: 0 },
      { x: 3, y: 0, z: 1 }
    ];
    const edges = segmentsOf(VoxelSolid.of(cells).contour(VoxelShell.of(cells), [20, 0.5, 0.5]));
    const partial = edges.filter(
      (segment) => segment.startsWith("1,1,") && segment.endsWith(",1,1,4")
    );

    assert.strictEqual(partial.length, 1);
    assert.notStrictEqual(partial[0], "1,1,0,1,1,4");
  });

  test("traces a ball with a fraction of its facing edges", () => {
    const ball = new BrushFootprint({
      position: { x: 0, y: 0, z: 0 },
      size: 8,
      axis: "xyz",
      pattern: "circle",
      anchor: "center"
    }).cells();
    const shell = VoxelShell.of(ball);
    const eye = [14, 12, 20];
    const contour = VoxelSolid.of(ball).contour(shell, eye);

    assert.ok(contour.length > 0);
    assert.ok(lengthOf(contour) < lengthOf(shell.edgesFacing(eye)) / 3);
  });
});
