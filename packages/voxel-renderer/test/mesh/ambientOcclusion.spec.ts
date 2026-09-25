// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import {
  aoCornerLevel,
  aoVertexByte,
  packAoCorners,
  AO_UNOCCLUDED
} from "../../src/mesh/ambientOcclusion.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import {
  buildChunk,
  fillBox,
  makeMeshFixture,
  place,
  type MeshFixture,
  type Vec3Tuple
} from "../helpers/meshFixture.ts";

// CONSTANTS
const kCutoutId = 6;
const kSlabId = 7;
const kLit = 127;
const kOneSide = 85;
const kTwoLevelsDown = 42;
const kUp: Vec3Tuple = [0, 127, 0];
const kPosX: Vec3Tuple = [127, 0, 0];

interface ShadedVertex {
  position: Vec3Tuple;
  shade: number;
}

function makeFixture(
  greedy: boolean,
  ambientOcclusion = true
): MeshFixture {
  const fixture = makeMeshFixture({ greedy, ambientOcclusion });
  fixture.blockRegistry.register(
    makeBlockDef(kCutoutId, "cube", {
      alphaMode: "mask",
      alphaCutoff: 0.5
    })
  );
  fixture.blockRegistry.register(makeBlockDef(kSlabId, "slabBottom"));

  return fixture;
}

function geometriesOf(
  fixture: MeshFixture,
  chunk: Vec3Tuple = [0, 0, 0]
): THREE.BufferGeometry[] {
  return [...buildChunk(fixture, chunk).values()];
}

function shadedVertices(
  geometries: THREE.BufferGeometry[],
  normal: Vec3Tuple
): ShadedVertex[] {
  const vertices: ShadedVertex[] = [];

  for (const geometry of geometries) {
    const positions = geometry.getAttribute("position").array;
    const normals = geometry.getAttribute("normal").array;
    for (let i = 0; i < geometry.getAttribute("position").count; i++) {
      if (
        normals[i * 4] !== normal[0] ||
        normals[(i * 4) + 1] !== normal[1] ||
        normals[(i * 4) + 2] !== normal[2]
      ) {
        continue;
      }

      vertices.push({
        position: [
          positions[i * 3],
          positions[(i * 3) + 1],
          positions[(i * 3) + 2]
        ],
        shade: normals[(i * 4) + 3]
      });
    }
  }

  return vertices;
}

function shadesAt(
  vertices: ShadedVertex[],
  [x, y, z]: Vec3Tuple
): number[] {
  const shades = vertices
    .filter(({ position }) => position[0] === x && position[1] === y && position[2] === z)
    .map(({ shade }) => shade);

  return [...new Set(shades)];
}

function upFacingQuadsAt(
  geometries: THREE.BufferGeometry[],
  y: number
): number {
  return shadedVertices(geometries, kUp)
    .filter(({ position }) => position[1] === y)
    .length / 4;
}

describe("ambient occlusion corner rule", () => {
  it("drops one level per occluder and darkens fully between two sides", () => {
    assert.equal(aoCornerLevel(false, false, false), 3);
    assert.equal(aoCornerLevel(true, false, false), 2);
    assert.equal(aoCornerLevel(false, false, true), 2);
    assert.equal(aoCornerLevel(true, false, true), 1);
    assert.equal(aoCornerLevel(true, true, false), 0);
    assert.equal(aoCornerLevel(true, true, true), 0);
  });

  it("interpolates packed corners bilinearly into a normal byte", () => {
    const corners = packAoCorners(0, 3, 3, 3);

    assert.equal(aoVertexByte(corners, 0, 0), 0);
    assert.equal(aoVertexByte(corners, 1, 0), kLit);
    assert.equal(aoVertexByte(corners, 0.5, 0), 64);
    assert.equal(aoVertexByte(corners, 0.5, 0.5), 95);
    assert.equal(aoVertexByte(AO_UNOCCLUDED, 0.3, 0.7), kLit);
  });
});

for (const greedy of [false, true]) {
  describe(`ambient occlusion baking (${greedy ? "greedy" : "naive"})`, () => {
    it("leaves every vertex lit when disabled", () => {
      const fixture = makeFixture(greedy, false);
      place(fixture, [1, 0, 1]);
      place(fixture, [2, 1, 1]);
      place(fixture, [1, 1, 2]);

      const shades = shadedVertices(geometriesOf(fixture), kUp);

      assert.deepEqual([...new Set(shades.map(({ shade }) => shade))], [kLit]);
    });

    it("darkens the corners beside one occluding side", () => {
      const fixture = makeFixture(greedy);
      place(fixture, [1, 0, 1]);
      place(fixture, [2, 1, 1]);

      const top = shadedVertices(geometriesOf(fixture), kUp);

      assert.deepEqual(shadesAt(top, [2, 1, 1]), [kOneSide]);
      assert.deepEqual(shadesAt(top, [2, 1, 2]), [kOneSide]);
      assert.deepEqual(shadesAt(top, [1, 1, 1]), [kLit]);
      assert.deepEqual(shadesAt(top, [1, 1, 2]), [kLit]);
    });

    it("turns a corner black between two occluding sides", () => {
      const fixture = makeFixture(greedy);
      place(fixture, [1, 0, 1]);
      place(fixture, [2, 1, 1]);
      place(fixture, [1, 1, 2]);

      const top = shadedVertices(geometriesOf(fixture), kUp);

      assert.deepEqual(shadesAt(top, [2, 1, 2]), [0]);
      assert.deepEqual(shadesAt(top, [2, 1, 1]), [kOneSide]);
      assert.deepEqual(shadesAt(top, [1, 1, 2]), [kOneSide]);
      assert.deepEqual(shadesAt(top, [1, 1, 1]), [kLit]);
    });

    it("casts nothing from a cutout block", () => {
      const fixture = makeFixture(greedy);
      place(fixture, [1, 0, 1]);
      place(fixture, [2, 1, 1], kCutoutId);

      const top = shadedVertices(geometriesOf(fixture), kUp)
        .filter(({ position }) => position[1] === 1);

      assert.deepEqual([...new Set(top.map(({ shade }) => shade))], [kLit]);
    });

    it("splits each quad along the diagonal joining its brighter corners", () => {
      const fixture = makeFixture(greedy);
      place(fixture, [1, 0, 1]);
      place(fixture, [2, 1, 2]);
      place(fixture, [0, 1, 0]);

      for (const geometry of geometriesOf(fixture)) {
        const normals = geometry.getAttribute("normal").array;
        for (let quad = 0; quad < normals.length; quad += 16) {
          const diagonal = normals[quad + 3] + normals[quad + 11];
          const opposite = normals[quad + 7] + normals[quad + 15];

          assert.ok(diagonal >= opposite);
        }
      }
      const top = shadedVertices(geometriesOf(fixture), kUp);
      assert.deepEqual(shadesAt(top, [2, 1, 2]), [kOneSide]);
      assert.deepEqual(shadesAt(top, [1, 1, 1]), [kOneSide]);
    });

    it("interpolates across a partial face", () => {
      const fixture = makeFixture(greedy);
      place(fixture, [1, 0, 1], kSlabId);
      place(fixture, [2, 1, 1]);

      const side = shadedVertices(geometriesOf(fixture), kPosX)
        .filter(({ position }) => position[0] === 2);

      assert.deepEqual(shadesAt(side, [2, 0, 1]), [kLit]);
      assert.deepEqual(shadesAt(side, [2, 0.5, 1]), [106]);
    });

    it("samples occluders across a chunk corner", () => {
      const fixture = makeFixture(greedy);
      place(fixture, [3, 0, 3]);
      place(fixture, [4, 1, 4]);

      const top = shadedVertices(geometriesOf(fixture), kUp);

      assert.deepEqual(shadesAt(top, [4, 1, 4]), [kOneSide]);
      assert.deepEqual(shadesAt(top, [3, 1, 3]), [kLit]);
    });
  });
}

describe("ambient occlusion with greedy merging", () => {
  it("keeps cells with different occlusion in separate quads", () => {
    const off = makeFixture(true, false);
    const on = makeFixture(true);
    for (const fixture of [off, on]) {
      fillBox(fixture, { from: [0, 0, 1], to: [3, 0, 1] });
      place(fixture, [0, 1, 2]);
    }

    assert.equal(upFacingQuadsAt(geometriesOf(off), 1), 1);
    assert.ok(upFacingQuadsAt(geometriesOf(on), 1) > 1);
  });

  it("still merges cells that share the same occlusion", () => {
    const fixture = makeFixture(true);
    fillBox(fixture, { from: [0, 0, 1], to: [3, 0, 1] });
    fillBox(fixture, { from: [-1, 1, 2], to: [4, 1, 2] });

    const geometries = geometriesOf(fixture);
    const top = shadedVertices(geometries, kUp)
      .filter(({ position }) => position[1] === 1);

    assert.equal(upFacingQuadsAt(geometries, 1), 1);
    assert.deepEqual(shadesAt(top, [0, 1, 2]), [kTwoLevelsDown]);
    assert.deepEqual(shadesAt(top, [4, 1, 2]), [kTwoLevelsDown]);
    assert.deepEqual(shadesAt(top, [0, 1, 1]), [kLit]);
  });
});
