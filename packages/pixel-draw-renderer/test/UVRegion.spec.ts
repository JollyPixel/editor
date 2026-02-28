// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UVRegion } from "../src/UVRegion.ts";

function makeRegion(overrides?: Partial<ConstructorParameters<typeof UVRegion>[0]>): UVRegion {
  return new UVRegion({
    id: "r1",
    label: "Top",
    u: 0.1,
    v: 0.2,
    width: 0.5,
    height: 0.3,
    color: "#f00",
    ...overrides
  });
}

describe("UVRegion", () => {
  describe("constructor", () => {
    test("stores all fields", () => {
      const r = makeRegion();
      assert.strictEqual(r.id, "r1");
      assert.strictEqual(r.label, "Top");
      assert.strictEqual(r.u, 0.1);
      assert.strictEqual(r.v, 0.2);
      assert.strictEqual(r.width, 0.5);
      assert.strictEqual(r.height, 0.3);
      assert.strictEqual(r.color, "#f00");
    });
  });

  describe("clamp", () => {
    test("clamps u and v to [0, 1]", () => {
      const r = makeRegion({ u: -0.5, v: 1.5, width: 0.1, height: 0.1 });
      r.clamp();
      assert.strictEqual(r.u, 0);
      assert.strictEqual(r.v, 1);
    });

    test("clamps width and height so region stays in bounds", () => {
      const r = makeRegion({ u: 0.8, v: 0.8, width: 0.5, height: 0.5 });
      r.clamp();
      assert.ok(r.u + r.width <= 1, "u + width should be <= 1");
      assert.ok(r.v + r.height <= 1, "v + height should be <= 1");
    });

    test("does not modify already-valid region", () => {
      const r = makeRegion({ u: 0, v: 0, width: 0.5, height: 0.5 });
      r.clamp();
      assert.strictEqual(r.u, 0);
      assert.strictEqual(r.v, 0);
      assert.strictEqual(r.width, 0.5);
      assert.strictEqual(r.height, 0.5);
    });

    test("clamps width to 0 when u is already 1", () => {
      const r = makeRegion({ u: 1, v: 0, width: 0.3, height: 0.1 });
      r.clamp();
      assert.strictEqual(r.width, 0);
    });
  });

  describe("snapToPixel", () => {
    test("snaps u and v to nearest pixel boundary", () => {
      const r = makeRegion({ u: 0.33, v: 0.66, width: 0.25, height: 0.25 });
      r.snapToPixel(4, 4);
      // 0.33 * 4 = 1.32 → rounds to 1 → 1/4 = 0.25
      assert.strictEqual(r.u, 0.25);
      // 0.66 * 4 = 2.64 → rounds to 3 → 3/4 = 0.75
      assert.strictEqual(r.v, 0.75);
    });

    test("snaps aligned value to itself", () => {
      const r = makeRegion({ u: 0.25, v: 0.5, width: 0.25, height: 0.25 });
      r.snapToPixel(4, 4);
      assert.strictEqual(r.u, 0.25);
      assert.strictEqual(r.v, 0.5);
    });

    test("snaps width and height to pixel boundaries", () => {
      const r = makeRegion({ u: 0, v: 0, width: 0.37, height: 0.63 });
      r.snapToPixel(4, 4);
      // 0.37 * 4 = 1.48 → 1 → 0.25
      assert.strictEqual(r.width, 0.25);
      // 0.63 * 4 = 2.52 → 3 → 0.75
      assert.strictEqual(r.height, 0.75);
    });
  });

  describe("toData / fromData", () => {
    test("toData returns an object matching the region state", () => {
      const r = makeRegion();
      const data = r.toData();
      assert.deepStrictEqual(data, {
        id: "r1",
        label: "Top",
        u: 0.1,
        v: 0.2,
        width: 0.5,
        height: 0.3,
        color: "#f00"
      });
    });

    test("toData returns a separate object (not a reference)", () => {
      const r = makeRegion();
      const data = r.toData();
      r.u = 0.9;
      assert.strictEqual(data.u, 0.1, "toData snapshot should not reflect subsequent mutation");
    });

    test("fromData restores all fields", () => {
      const r = makeRegion();
      r.fromData({ id: "r2", label: "Bottom", u: 0.5, v: 0.5, width: 0.1, height: 0.1, color: "#0f0" });
      assert.strictEqual(r.id, "r2");
      assert.strictEqual(r.label, "Bottom");
      assert.strictEqual(r.u, 0.5);
      assert.strictEqual(r.color, "#0f0");
    });

    test("fromData / toData roundtrip", () => {
      const r = makeRegion();
      const original = r.toData();
      r.u = 0.99;
      r.fromData(original);
      assert.deepStrictEqual(r.toData(), original);
    });
  });
});
