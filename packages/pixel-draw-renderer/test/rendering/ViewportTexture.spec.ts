// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ViewportTexture } from "../../src/rendering/ViewportTexture.ts";

describe("ViewportTexture", () => {
  describe("constructor", () => {
    test("clones the given size (defensive copy)", () => {
      const size = { x: 8, y: 8 };
      const texture = new ViewportTexture({ size });
      size.x = 100;
      assert.strictEqual(texture.size.x, 8);
    });
  });

  describe("resize", () => {
    test("replaces the size (defensive copy)", () => {
      const texture = new ViewportTexture({ size: { x: 8, y: 8 } });
      const size = { x: 16, y: 32 };
      texture.resize(size);
      size.x = 100;
      assert.deepStrictEqual(texture.size, { x: 16, y: 32 });
    });

    test("calls onResize after the size is updated", () => {
      const sizeSeenByCallback: { x: number; y: number; }[] = [];
      const texture = new ViewportTexture({
        size: { x: 8, y: 8 },
        onResize: () => sizeSeenByCallback.push({ ...texture.size })
      });
      texture.resize({ x: 16, y: 32 });
      assert.deepStrictEqual(sizeSeenByCallback, [{ x: 16, y: 32 }]);
    });

    test("does not require an onResize callback", () => {
      const texture = new ViewportTexture({ size: { x: 8, y: 8 } });
      assert.doesNotThrow(() => texture.resize({ x: 16, y: 16 }));
    });
  });

  describe("pixelSize", () => {
    test("returns size scaled by zoom", () => {
      const texture = new ViewportTexture({ size: { x: 10, y: 20 } });
      assert.deepStrictEqual(texture.pixelSize(3), { x: 30, y: 60 });
    });
  });

  describe("contains", () => {
    test("returns true for a position within bounds", () => {
      const texture = new ViewportTexture({ size: { x: 16, y: 16 } });
      assert.ok(texture.contains({ x: 0, y: 0 }));
      assert.ok(texture.contains({ x: 15, y: 15 }));
    });

    test("returns false for a position outside bounds", () => {
      const texture = new ViewportTexture({ size: { x: 16, y: 16 } });
      assert.strictEqual(texture.contains({ x: -1, y: 0 }), false);
      assert.strictEqual(texture.contains({ x: 0, y: 16 }), false);
      assert.strictEqual(texture.contains({ x: 16, y: 0 }), false);
    });
  });
});
