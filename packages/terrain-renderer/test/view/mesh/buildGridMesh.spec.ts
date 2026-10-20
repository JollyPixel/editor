// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { quadDiagonal } from "#src/document/quadDiagonal.ts";
import {
  buildGridMesh,
  type NodeMeshData
} from "#src/view/mesh/buildGridMesh.ts";

// CONSTANTS
const kResolution = 8;
const kSkirtDepth = 1;

type Vec3 = [number, number, number];

function hashHeight(
  x: number,
  z: number
): number {
  return Math.sin(x * 12.9898 + z * 78.233) * 43.758 % 7;
}

function vertex(
  mesh: NodeMeshData,
  index: number,
  height: (x: number, z: number) => number
): Vec3 {
  const x = mesh.grid[index * 4];
  const z = mesh.grid[index * 4 + 1];
  const skirt = mesh.grid[index * 4 + 2] !== 0 || mesh.grid[index * 4 + 3] !== 0 ? 1 : 0;

  return [x, height(x, z) - skirt * kSkirtDepth, z];
}

function triangles(
  mesh: NodeMeshData,
  height: (x: number, z: number) => number = () => 0
): Vec3[][] {
  const result: Vec3[][] = [];
  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    result.push([0, 1, 2].map((corner) => vertex(mesh, mesh.indices[offset + corner], height)));
  }

  return result;
}

function normal(
  [a, b, c]: Vec3[]
): Vec3 {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];

  return [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0]
  ];
}

function isSkirt(
  triangle: Vec3[]
): boolean {
  return triangle.some(([, y]) => y < 0);
}

function hasCorner(
  triangle: Vec3[],
  x: number,
  z: number
): boolean {
  return triangle.some(([vx, , vz]) => vx === x && vz === z);
}

function coarseHeight(
  x: number,
  z: number
): number {
  const quadX = Math.min(Math.floor(x / 2), kResolution / 2 - 1);
  const quadZ = Math.min(Math.floor(z / 2), kResolution / 2 - 1);
  const u = x / 2 - quadX;
  const v = z / 2 - quadZ;
  function corner(dx: number, dz: number): number {
    return hashHeight((quadX + dx) * 2, (quadZ + dz) * 2);
  }
  if (quadDiagonal(quadX, quadZ) === "main") {
    return u >= v ?
      corner(0, 0) + u * (corner(1, 0) - corner(0, 0)) + v * (corner(1, 1) - corner(1, 0)) :
      corner(0, 0) + v * (corner(0, 1) - corner(0, 0)) + u * (corner(1, 1) - corner(0, 1));
  }

  return u + v <= 1 ?
    corner(0, 0) + u * (corner(1, 0) - corner(0, 0)) + v * (corner(0, 1) - corner(0, 0)) :
    corner(1, 1) + (1 - u) * (corner(0, 1) - corner(1, 1)) + (1 - v) * (corner(1, 0) - corner(1, 1));
}

describe("quadDiagonal", () => {
  test("alternates from one quad to the next on both axes", () => {
    for (let z = -3; z < 3; z++) {
      for (let x = -3; x < 3; x++) {
        assert.notEqual(quadDiagonal(x, z), quadDiagonal(x + 1, z));
        assert.notEqual(quadDiagonal(x, z), quadDiagonal(x, z + 1));
      }
    }
  });
});

describe("buildGridMesh", () => {
  test("the surface faces up and the skirts face out", () => {
    const mesh = buildGridMesh(kResolution);
    const center = kResolution / 2;

    for (const triangle of triangles(mesh)) {
      const [nx, ny, nz] = normal(triangle);
      if (isSkirt(triangle)) {
        const outward: Vec3 = [triangle[0][0] - center, 0, triangle[0][2] - center];
        assert.ok(nx * outward[0] + nz * outward[2] > 0, "skirt faces out");
      }
      else {
        assert.ok(ny > 0, "surface faces up");
      }
    }
  });

  test("each skirt vertex points away from the node", () => {
    const mesh = buildGridMesh(kResolution);
    const center = kResolution / 2;
    const side = kResolution + 1;
    const skirtCount = mesh.grid.length / 4 - side * side;

    assert.equal(skirtCount, side * 4);
    for (let index = side * side; index < side * side + skirtCount; index++) {
      const [x, z, outwardX, outwardZ] = mesh.grid.subarray(index * 4, index * 4 + 4);

      assert.equal(Math.abs(outwardX) + Math.abs(outwardZ), 1);
      assert.ok(outwardX * (x - center) + outwardZ * (z - center) > 0, `vertex (${x}, ${z})`);
    }
  });

  test("each quad is split along its quadDiagonal", () => {
    const mesh = buildGridMesh(kResolution);
    const surface = triangles(mesh).filter((triangle) => !isSkirt(triangle));

    assert.equal(surface.length, kResolution * kResolution * 2);
    for (const triangle of surface) {
      const quadX = Math.min(...triangle.map(([x]) => x));
      const quadZ = Math.min(...triangle.map(([, , z]) => z));
      if (quadDiagonal(quadX, quadZ) === "main") {
        assert.ok(hasCorner(triangle, quadX, quadZ) && hasCorner(triangle, quadX + 1, quadZ + 1));
      }
      else {
        assert.ok(hasCorner(triangle, quadX + 1, quadZ) && hasCorner(triangle, quadX, quadZ + 1));
      }
    }
  });

  test("fully morphed, every vertex lies on the coarser level's surface", () => {
    const mesh = buildGridMesh(kResolution);
    const side = kResolution + 1;

    for (let index = 0; index < side * side; index++) {
      const x = mesh.grid[index * 4];
      const z = mesh.grid[index * 4 + 1];
      const [ax, az, bx, bz] = mesh.morph.subarray(index * 4, index * 4 + 4);
      const morphed = ax === 0 && az === 0 && bx === 0 && bz === 0 ?
        hashHeight(x, z) :
        (hashHeight(x + ax, z + az) + hashHeight(x + bx, z + bz)) / 2;

      assert.ok(Math.abs(morphed - coarseHeight(x, z)) < 1e-9, `vertex (${x}, ${z})`);
    }
  });

  test("no fine triangle crosses a coarse quad's diagonal", () => {
    const mesh = buildGridMesh(kResolution);

    for (const triangle of triangles(mesh).filter((corners) => !isSkirt(corners))) {
      const quadX = Math.floor(Math.min(...triangle.map(([x]) => x)) / 2);
      const quadZ = Math.floor(Math.min(...triangle.map(([, , z]) => z)) / 2);
      const sides = triangle.map(([x, , z]) => {
        const u = x / 2 - quadX;
        const v = z / 2 - quadZ;

        return Math.sign(quadDiagonal(quadX, quadZ) === "main" ? u - v : 1 - u - v);
      });

      assert.ok(!(sides.includes(1) && sides.includes(-1)), `triangle at (${quadX}, ${quadZ})`);
    }
  });

  test("rejects an odd or too small resolution", () => {
    assert.throws(() => buildGridMesh(7), RangeError);
    assert.throws(() => buildGridMesh(0), RangeError);
  });
});
