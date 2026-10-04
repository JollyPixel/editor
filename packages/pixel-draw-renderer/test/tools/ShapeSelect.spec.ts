// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ShapeSelect } from "#src/tools/ShapeSelect.ts";
import { PixelBuffer } from "#src/buffer/PixelBuffer.ts";
import type {
  RGBA8,
  Vec2
} from "#src/types.ts";

// CONSTANTS
const kTestMaxSize = 32;
const kBorder: RGBA8 = { r: 0, g: 0, b: 0, a: 255 };
const kInside: RGBA8 = { r: 255, g: 255, b: 255, a: 255 };
const kOutside: RGBA8 = { r: 200, g: 200, b: 200, a: 255 };

function fillAll(
  buf: PixelBuffer,
  size: { x: number; y: number; },
  color: RGBA8
): void {
  const all: Vec2[] = [];
  for (let y = 0; y < size.y; y++) {
    for (let x = 0; x < size.x; x++) {
      all.push({ x, y });
    }
  }
  buf.drawPixels(all, color);
}

describe("ShapeSelect", () => {
  describe("compute", () => {
    test("returns null when the seed has no matching neighbors (isolated 1x1)", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        defaultColor: kOutside,
        maxSize: kTestMaxSize
      });
      buf.drawPixels([
        { x: 1, y: 1 }
      ], kBorder);

      assert.strictEqual(
        ShapeSelect.compute(buf, { x: 1, y: 1 }),
        null
      );
    });

    test("returns null when the seed is out of bounds", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });

      assert.strictEqual(
        ShapeSelect.compute(buf, { x: -1, y: 0 }),
        null
      );
    });

    test("a plain filled rectangle selects exactly its own bounding box (full mask)", () => {
      const buf = new PixelBuffer({
        size: { x: 6, y: 6 },
        defaultColor: kOutside,
        maxSize: kTestMaxSize
      });
      const block: Vec2[] = [];
      for (let y = 1; y < 4; y++) {
        for (let x = 1; x < 3; x++) {
          block.push({ x, y });
        }
      }
      buf.drawPixels(block, kInside);

      const result = ShapeSelect.compute(
        buf,
        { x: 1, y: 2 }
      );

      assert.deepStrictEqual(
        result!.rect,
        { x: 1, y: 1, width: 2, height: 3 }
      );
      assert.deepStrictEqual(
        result!.mask,
        Array.from({ length: 6 }, () => true)
      );
    });

    test("a hollow ring (border only) selects the border AND its fully enclosed interior", () => {
      const buf = new PixelBuffer({
        size: { x: 5, y: 5 },
        maxSize: kTestMaxSize
      });
      fillAll(buf, { x: 5, y: 5 }, kBorder);
      const interior: Vec2[] = [];
      for (let y = 1; y < 4; y++) {
        for (let x = 1; x < 4; x++) {
          interior.push({ x, y });
        }
      }
      buf.drawPixels(interior, kInside);

      const result = ShapeSelect.compute(
        buf,
        { x: 0, y: 0 }
      );

      assert.deepStrictEqual(
        result!.rect,
        { x: 0, y: 0, width: 5, height: 5 }
      );
      assert.deepStrictEqual(
        result!.mask,
        Array.from({ length: 25 }, () => true)
      );
    });

    test("an L-shaped region (concave, no enclosed hole) keeps its true concave outline", () => {
      const buf = new PixelBuffer({
        size: { x: 3, y: 3 },
        defaultColor: kOutside,
        maxSize: kTestMaxSize
      });
      buf.drawPixels(
        [
          { x: 0, y: 1 },
          { x: 0, y: 2 },
          { x: 1, y: 2 },
          { x: 2, y: 2 }
        ],
        kBorder
      );

      const result = ShapeSelect.compute(buf, { x: 0, y: 1 });

      assert.deepStrictEqual(
        result!.rect,
        { x: 0, y: 1, width: 3, height: 2 }
      );
      assert.deepStrictEqual(
        result!.mask,
        [true, false, false, true, true, true]
      );
    });

    for (const { opening, walls } of [
      {
        opening: "bottom",
        walls: [
          true, true, true,
          true, false, true,
          true, false, true
        ]
      },
      {
        opening: "top",
        walls: [
          true, false, true,
          true, false, true,
          true, true, true
        ]
      },
      {
        opening: "left",
        walls: [
          true, true, true,
          false, false, true,
          true, true, true
        ]
      },
      {
        opening: "right",
        walls: [
          true, true, true,
          true, false, false,
          true, true, true
        ]
      }
    ]) {
      test(`an arch open at the ${opening} keeps its notch unselected`, () => {
        const buf = new PixelBuffer({
          size: { x: 3, y: 3 },
          defaultColor: kOutside,
          maxSize: kTestMaxSize
        });
        buf.drawPixels(
          walls.flatMap((isWall, index) => (
            isWall ? [{ x: index % 3, y: Math.floor(index / 3) }] : []
          )),
          kBorder
        );

        const result = ShapeSelect.compute(buf, { x: 0, y: 0 });

        assert.deepStrictEqual(
          result!.rect,
          { x: 0, y: 0, width: 3, height: 3 }
        );
        assert.deepStrictEqual(result!.mask, walls);
      });
    }
  });
});
