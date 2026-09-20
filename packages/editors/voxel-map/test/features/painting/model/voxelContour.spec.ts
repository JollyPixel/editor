// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  contourEdges,
  voxelSolid
} from "../../../../src/features/painting/model/voxelContour.ts";
import {
  edgesFacing,
  voxelShell
} from "../../../../src/features/painting/model/voxelShell.ts";
import { cellsOf } from "../../../../src/features/painting/model/brushFootprint.ts";

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

describe("contourEdges", () => {
  const cube = [{ x: 0, y: 0, z: 0 }];

  test("keeps the hexagon around a cube seen from a corner", () => {
    const edges = contourEdges(
      voxelShell(cube),
      voxelSolid(cube),
      [5, 5, 5]
    );

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
    const edges = contourEdges(
      voxelShell(cube),
      voxelSolid(cube),
      [0.5, 5, 0.5]
    );

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
    const shell = voxelShell(stair);
    const eye = [4, 10, 0.5];
    const step = "1,2,0,1,2,1";

    assert.ok(segmentsOf(edgesFacing(shell, eye)).includes(step));
    assert.ok(
      !segmentsOf(contourEdges(shell, voxelSolid(stair), eye)).includes(step)
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
    const edges = segmentsOf(contourEdges(
      voxelShell(cells),
      voxelSolid(cells),
      [20, 0.5, 0.5]
    ));
    const partial = edges.filter(
      (segment) => segment.startsWith("1,1,") && segment.endsWith(",1,1,4")
    );

    assert.strictEqual(partial.length, 1);
    assert.notStrictEqual(partial[0], "1,1,0,1,1,4");
  });

  test("traces a ball with a fraction of its facing edges", () => {
    const ball = cellsOf({
      position: { x: 0, y: 0, z: 0 },
      size: 8,
      axis: "xyz",
      pattern: "circle",
      anchor: "center"
    });
    const shell = voxelShell(ball);
    const eye = [14, 12, 20];
    const contour = contourEdges(shell, voxelSolid(ball), eye);

    assert.ok(contour.length > 0);
    assert.ok(lengthOf(contour) < lengthOf(edgesFacing(shell, eye)) / 3);
  });
});
