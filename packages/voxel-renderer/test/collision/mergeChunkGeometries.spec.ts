// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { mergeChunkGeometries } from "../../src/collision/mergeChunkGeometries.ts";

function makeGeometry(
  positions: number[],
  indices: number[]
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setIndex(indices);

  return geometry;
}

// One triangle, 3 vertices.
function makeTriangle(offset = 0): THREE.BufferGeometry {
  return makeGeometry(
    [offset, 0, 0, offset + 1, 0, 0, offset, 1, 0],
    [0, 1, 2]
  );
}

describe("mergeChunkGeometries", () => {
  it("returns null for an empty map", () => {
    assert.equal(mergeChunkGeometries(new Map()), null);
  });

  it("returns the input geometry unowned on the single-tileset fast path", () => {
    const geometry = makeTriangle();

    const merged = mergeChunkGeometries(new Map([["atlas", geometry]]));

    assert.ok(merged);
    assert.equal(merged.geometry, geometry, "no copy should be allocated");
    assert.equal(merged.owned, false);
  });

  it("concatenates positions and returns an owned geometry", () => {
    const merged = mergeChunkGeometries(new Map([
      ["a", makeTriangle(0)],
      ["b", makeTriangle(10)]
    ]));

    assert.ok(merged);
    assert.equal(merged.owned, true);
    assert.equal(merged.geometry.getAttribute("position").count, 6);
  });

  it("offsets indices of subsequent geometries by the preceding vertex count", () => {
    const merged = mergeChunkGeometries(new Map([
      ["a", makeTriangle(0)],
      ["b", makeTriangle(10)]
    ]));

    assert.ok(merged);
    assert.deepEqual(
      [...merged.geometry.getIndex()!.array],
      [0, 1, 2, 3, 4, 5],
      "second triangle's indices must be shifted by 3"
    );
  });

  it("keeps only collision-relevant attributes", () => {
    const first = makeTriangle(0);
    first.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));

    const merged = mergeChunkGeometries(new Map([
      ["a", first],
      ["b", makeTriangle(10)]
    ]));

    assert.ok(merged);
    assert.equal(merged.geometry.getAttribute("uv"), undefined);
  });

  it("skips non-indexed geometries", () => {
    const nonIndexed = new THREE.BufferGeometry();
    nonIndexed.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3)
    );

    const merged = mergeChunkGeometries(new Map([
      ["a", makeTriangle(0)],
      ["b", nonIndexed]
    ]));

    assert.ok(merged);
    assert.equal(merged.geometry.getAttribute("position").count, 3);
  });

  it("returns null when every geometry is skipped", () => {
    const nonIndexed = new THREE.BufferGeometry();
    nonIndexed.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const other = new THREE.BufferGeometry();
    other.setAttribute("position", new THREE.Float32BufferAttribute([1, 1, 1], 3));

    const merged = mergeChunkGeometries(new Map([
      ["a", nonIndexed],
      ["b", other]
    ]));

    assert.equal(merged, null);
  });
});

describe("mergeChunkGeometries — buffer types", () => {
  it("allocates typed arrays rather than boxed number arrays", () => {
    const merged = mergeChunkGeometries(new Map([
      ["a", makeTriangle(0)],
      ["b", makeTriangle(10)]
    ]));

    assert.ok(merged);
    assert.ok(merged.geometry.getAttribute("position").array instanceof Float32Array);
    assert.ok(merged.geometry.getIndex()!.array instanceof Uint32Array);
  });

  it("preserves every vertex of every source geometry", () => {
    const merged = mergeChunkGeometries(new Map([
      ["a", makeTriangle(0)],
      ["b", makeTriangle(10)]
    ]));

    assert.ok(merged);
    assert.deepEqual(
      [...merged.geometry.getAttribute("position").array],
      [0, 0, 0, 1, 0, 0, 0, 1, 0, 10, 0, 0, 11, 0, 0, 10, 1, 0]
    );
  });
});
