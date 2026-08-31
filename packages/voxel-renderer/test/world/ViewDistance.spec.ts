// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ViewDistance } from "../../src/world/ViewDistance.ts";

describe("ViewDistance", () => {
  it("is unlimited by default", () => {
    const distance = new ViewDistance();

    assert.equal(distance.chunks, Infinity);
    assert.equal(distance.unlimited, true);
    assert.equal(distance.admits(1e9, 1e9, 1e9, 16), true);
  });

  it("takes a radius in chunks on its own", () => {
    const distance = ViewDistance.from(2);

    assert.equal(distance.chunks, 2);
    assert.equal(distance.shape, "xz");
    assert.equal(distance.hysteresis, 1);
  });

  it("returns a ViewDistance unchanged", () => {
    const distance = new ViewDistance({ chunks: 4 });

    assert.equal(ViewDistance.from(distance), distance);
  });

  it("rejects a negative radius", () => {
    assert.throws(
      () => new ViewDistance({ chunks: -1 }),
      RangeError
    );
  });

  it("rejects a negative hysteresis", () => {
    assert.throws(
      () => new ViewDistance({ chunks: 1, hysteresis: -1 }),
      RangeError
    );
  });

  it("measures the radius in world units", () => {
    const distance = new ViewDistance({ chunks: 2, hysteresis: 0 });

    assert.equal(distance.admits(31, 0, 0, 16), true);
    assert.equal(distance.admits(33, 0, 0, 16), false);
  });

  it("ignores the vertical axis in xz shape", () => {
    const distance = new ViewDistance({ chunks: 1, hysteresis: 0 });

    assert.equal(distance.admits(0, 1000, 0, 16), true);
  });

  it("counts the vertical axis in sphere shape", () => {
    const distance = new ViewDistance({
      chunks: 1,
      shape: "sphere",
      hysteresis: 0
    });

    assert.equal(distance.admits(0, 1000, 0, 16), false);
  });

  it("retains a chunk one hysteresis further than it admits it", () => {
    const distance = new ViewDistance({ chunks: 1, hysteresis: 1 });

    assert.equal(distance.admits(24, 0, 0, 16), false);
    assert.equal(distance.retains(24, 0, 0, 16), true);
    assert.equal(distance.retains(33, 0, 0, 16), false);
  });

  it("compares by value", () => {
    const distance = new ViewDistance({ chunks: 3 });

    assert.equal(distance.equals(new ViewDistance({ chunks: 3 })), true);
    assert.equal(distance.equals(new ViewDistance({ chunks: 4 })), false);
  });
});
