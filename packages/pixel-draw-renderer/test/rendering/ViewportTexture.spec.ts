// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ViewportTexture } from "#src/rendering/ViewportTexture.ts";
import type { Vec2 } from "#src/types.ts";

describe("ViewportTexture", () => {
  describe("constructor", () => {
    test("clones the given size (defensive copy)", () => {
      const size = {
        x: 8,
        y: 8
      };
      const texture = makeTexture(size);
      size.x = 100;

      assert.strictEqual(texture.size.x, 8);
    });
  });

  describe("resize", () => {
    test("replaces the size (defensive copy)", () => {
      const texture = makeTexture({
        x: 8,
        y: 8
      });
      const size = {
        x: 16,
        y: 32
      };
      texture.resize(size);
      size.x = 100;

      assert.deepStrictEqual(
        texture.size,
        { x: 16, y: 32 }
      );
    });

    test("calls onResize after the size is updated", () => {
      const sizeSeenByCallback: Vec2[] = [];
      const texture = makeTexture(
        {
          x: 8,
          y: 8
        },
        () => sizeSeenByCallback.push({
          ...texture.size
        })
      );
      texture.resize({
        x: 16,
        y: 32
      });

      assert.deepStrictEqual(
        sizeSeenByCallback,
        [{ x: 16, y: 32 }]
      );
    });

    test("passes the previous size to onResize", () => {
      const previousSizes: Vec2[] = [];
      const texture = makeTexture(
        {
          x: 8,
          y: 8
        },
        (previous) => previousSizes.push({ ...previous })
      );
      texture.resize({
        x: 16,
        y: 32
      });

      assert.deepStrictEqual(
        previousSizes,
        [{ x: 8, y: 8 }]
      );
    });

    test("skips onResize when the size is unchanged", () => {
      let calls = 0;
      const texture = makeTexture(
        {
          x: 8,
          y: 8
        },
        () => {
          calls++;
        }
      );
      texture.resize({
        x: 8,
        y: 8
      });

      assert.strictEqual(calls, 0);
    });
  });

  describe("pixelSize", () => {
    test("returns size scaled by zoom", () => {
      const texture = makeTexture({
        x: 10,
        y: 20
      });

      assert.deepStrictEqual(
        texture.pixelSize(3),
        { x: 30, y: 60 }
      );
    });
  });

  describe("contains", () => {
    test("returns true for a position within bounds", () => {
      const texture = makeTexture({
        x: 16,
        y: 16
      });

      assert.ok(
        texture.contains({ x: 0, y: 0 })
      );
      assert.ok(
        texture.contains({ x: 15, y: 15 })
      );
    });

    test("returns false for a position outside bounds", () => {
      const texture = makeTexture({
        x: 16,
        y: 16
      });

      assert.ok(
        !texture.contains({ x: -1, y: 0 })
      );
      assert.ok(
        !texture.contains({ x: 0, y: 16 })
      );
      assert.ok(
        !texture.contains({ x: 16, y: 0 })
      );
    });
  });
});

function makeTexture(
  size: Vec2,
  onResize: (previous: Readonly<Vec2>) => void = () => undefined
): ViewportTexture {
  return new ViewportTexture({
    size,
    onResize
  });
}
