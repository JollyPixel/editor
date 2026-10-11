// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { VoxelShell } from "../../../../src/features/painting/rendering/VoxelShell.ts";
import { BrushFootprint } from "../../../../src/features/painting/model/BrushFootprint.ts";

function quadCount(
  triangles: number[]
): number {
  return triangles.length / 18;
}

function segmentsOf(
  edges: number[]
): string[] {
  const segments: string[] = [];
  for (let index = 0; index < edges.length; index += 6) {
    segments.push(edges.slice(index, index + 6).join(","));
  }

  return segments.sort();
}

function normalsOf(
  triangles: number[]
): string[] {
  const normals = new Set<string>();
  for (let index = 0; index < triangles.length; index += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = triangles.slice(index, index + 9);
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    normals.add([
      (uy * vz) - (uz * vy),
      (uz * vx) - (ux * vz),
      (ux * vy) - (uy * vx)
    ].map((value) => Math.sign(value) + 0).join(","));
  }

  return [...normals].sort();
}

describe("VoxelShell.fromCells", () => {
  test("a single cell is a cube with twelve edges", () => {
    const shell = VoxelShell.fromCells([{ x: 0, y: 0, z: 0 }]);

    assert.strictEqual(quadCount(shell.triangles), 6);
    assert.strictEqual(shell.edges.length / 6, 12);
  });

  test("winds every face outward", () => {
    const shell = VoxelShell.fromCells([{ x: 0, y: 0, z: 0 }]);
    const triangles = shell.triangles;
    const faces: string[] = [];

    for (let index = 0; index < triangles.length; index += 18) {
      faces.push(normalsOf(triangles.slice(index, index + 18))[0]);
    }

    assert.deepStrictEqual(faces.sort(), [
      "-1,0,0",
      "0,-1,0",
      "0,0,-1",
      "0,0,1",
      "0,1,0",
      "1,0,0"
    ]);
    for (let index = 0; index < triangles.length; index += 18) {
      const [nx, ny, nz] = normalsOf(triangles.slice(index, index + 18))[0]
        .split(",")
        .map(Number);
      const face = triangles.slice(index, index + 18);
      const center = [0, 1, 2].map(
        (axis) => face.filter((_, item) => item % 3 === axis)
          .reduce((sum, value) => sum + value, 0) / 6
      );

      assert.ok(
        ((center[0] - 0.5) * nx) + ((center[1] - 0.5) * ny) + ((center[2] - 0.5) * nz) > 0
      );
    }
  });

  test("a square footprint keeps the twelve edges of its box", () => {
    const shell = VoxelShell.fromCells(new BrushFootprint({
      position: { x: 0, y: 0, z: 0 },
      size: 3,
      axis: "xz",
      pattern: "square"
    }).cells());

    assert.deepStrictEqual(segmentsOf(shell.edges), segmentsOf([
      -1, 0, -1, 2, 0, -1,
      -1, 0, 2, 2, 0, 2,
      -1, 1, -1, 2, 1, -1,
      -1, 1, 2, 2, 1, 2,
      -1, 0, -1, -1, 0, 2,
      2, 0, -1, 2, 0, 2,
      -1, 1, -1, -1, 1, 2,
      2, 1, -1, 2, 1, 2,
      -1, 0, -1, -1, 1, -1,
      2, 0, -1, 2, 1, -1,
      -1, 0, 2, -1, 1, 2,
      2, 0, 2, 2, 1, 2
    ]));
  });

  test("hides the faces between neighbouring cells", () => {
    const shell = VoxelShell.fromCells([
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 }
    ]);

    assert.strictEqual(quadCount(shell.triangles), 10);
  });

  test("ignores duplicate cells", () => {
    const shell = VoxelShell.fromCells([
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 }
    ]);

    assert.strictEqual(quadCount(shell.triangles), 6);
  });

  test("outlines the steps of a disc", () => {
    const disc = new BrushFootprint({
      position: { x: 0, y: 0, z: 0 },
      size: 4,
      axis: "xz",
      pattern: "circle"
    }).cells();
    const shell = VoxelShell.fromCells(disc);

    assert.strictEqual(quadCount(shell.triangles), 12 + 12 + 16);
    assert.strictEqual(shell.edges.length / 6, 12 + 12 + 12);
  });

  test("covers a sphere with exterior faces only", () => {
    const ball = new BrushFootprint({
      position: { x: 0, y: 0, z: 0 },
      size: 4,
      axis: "xyz",
      pattern: "circle"
    }).cells();
    const shell = VoxelShell.fromCells(ball);

    assert.strictEqual(quadCount(shell.triangles), 72);
  });
});

describe("VoxelShell rims", () => {
  test("marks every corner of a single cell", () => {
    const shell = VoxelShell.fromCells([{ x: 0, y: 0, z: 0 }]);

    assert.strictEqual(shell.rims.length, shell.triangles.length / 3);
    assert.ok(shell.rims.every((rim) => rim === 1));
  });

  test("leaves the vertices inside a flat face unmarked", () => {
    const slab = new BrushFootprint({
      position: { x: 0, y: 0, z: 0 },
      size: 3,
      axis: "xz",
      pattern: "square"
    }).cells();
    const shell = VoxelShell.fromCells(slab);
    const min = Math.min(
      ...shell.edges.filter((_, index) => index % 3 === 0)
    );
    const inner = new Set([min + 1, min + 2]);

    for (let index = 0; index < shell.rims.length; index++) {
      const x = shell.triangles[index * 3];
      const z = shell.triangles[(index * 3) + 2];

      assert.strictEqual(
        shell.rims[index],
        inner.has(x) && inner.has(z) ? 0 : 1,
        `vertex ${x},${z}`
      );
    }
  });
});

describe("VoxelShell.edgesFacing", () => {
  const cube = VoxelShell.fromCells([{ x: 0, y: 0, z: 0 }]);

  test("keeps the nine edges of the three faces seen from a corner", () => {
    const edges = cube.edgesFacing([5, 5, 5]);

    assert.strictEqual(edges.length / 6, 9);
    assert.ok(!segmentsOf(edges).includes("0,0,0,1,0,0"));
    assert.ok(!segmentsOf(edges).includes("0,0,0,0,1,0"));
    assert.ok(!segmentsOf(edges).includes("0,0,0,0,0,1"));
  });

  test("keeps the four edges of the only face seen head-on", () => {
    const edges = cube.edgesFacing([0.5, 5, 0.5]);

    assert.deepStrictEqual(segmentsOf(edges), [
      "0,1,0,0,1,1",
      "0,1,0,1,1,0",
      "0,1,1,1,1,1",
      "1,1,0,1,1,1"
    ]);
  });

  test("keeps nothing from inside the shell", () => {
    assert.deepStrictEqual(cube.edgesFacing([0.5, 0.5, 0.5]), []);
  });

  test("splits a run where the faces meeting along it change", () => {
    const shell = VoxelShell.fromCells([
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 1, y: 1, z: 1 }
    ]);
    const convex = "1,1,0,1,1,1";
    const pinched = "1,1,1,1,1,2";

    assert.ok(segmentsOf(shell.edges).includes(convex));
    assert.ok(segmentsOf(shell.edges).includes(pinched));

    const facing = segmentsOf(shell.edgesFacing([-5, -5, 0.5]));
    assert.ok(!facing.includes(convex));
    assert.ok(facing.includes(pinched));
  });
});

describe("VoxelShell.facingKey", () => {
  const cube = VoxelShell.fromCells([{ x: 0, y: 0, z: 0 }]);

  test("holds while the eye stays on the same side of every plane", () => {
    assert.strictEqual(
      cube.facingKey([5, 5, 5]),
      cube.facingKey([2, 9, 3])
    );
  });

  test("changes once the eye crosses a face plane", () => {
    assert.notStrictEqual(
      cube.facingKey([5, 5, 5]),
      cube.facingKey([0.5, 5, 5])
    );
  });
});
