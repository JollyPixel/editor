// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { QuadIndex } from "../../src/mesh/QuadIndex.ts";

describe("QuadIndex", () => {
  it("indexes every quad as two triangles over its four vertices", () => {
    const index = new QuadIndex().forQuads(2);

    assert.deepEqual(
      [...index.array.subarray(0, 12)],
      [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]
    );
  });

  it("shares storage through independently owned, bounded attributes", () => {
    const quadIndex = new QuadIndex();
    const first = quadIndex.forQuads(10);

    const second = quadIndex.forQuads(20);

    assert.notEqual(second, first);
    assert.equal(second.array.buffer, first.array.buffer);
    assert.equal(first.count, 60);
    assert.equal(second.count, 120);
  });

  it("grows to a new attribute and leaves the previous one intact", () => {
    const quadIndex = new QuadIndex();
    const small = quadIndex.forQuads(1);
    const capacity = quadIndex.capacity;

    const large = quadIndex.forQuads(capacity + 1);

    assert.notEqual(large, small);
    assert.ok(quadIndex.capacity > capacity);
    assert.notEqual(small.array.buffer, large.array.buffer);
    assert.equal(small.count, 6);
    assert.equal(large.count, (capacity + 1) * 6);
  });
});
