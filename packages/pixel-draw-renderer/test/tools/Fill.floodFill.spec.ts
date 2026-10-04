// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Fill } from "#src/tools/Fill.ts";
import { PixelBuffer } from "#src/buffer/PixelBuffer.ts";
import type { Vec2 } from "#src/types.ts";
import {
  COLOR_A,
  COLOR_B,
  FILL_COLOR,
  TEST_MAX_SIZE,
  filledBuffer,
  sortPositions
} from "../helpers/fill/buffer.ts";

describe("Fill", () => {
  describe("floodFill", () => {
    test("fills a uniformly colored rectangle exactly (no under/over-fill)", () => {
      const buf = new PixelBuffer({
        size: { x: 6, y: 6 },
        maxSize: TEST_MAX_SIZE
      });
      const all: Vec2[] = [];
      for (let y = 0; y < 6; y++) {
        for (let x = 0; x < 6; x++) {
          all.push({ x, y });
        }
      }
      buf.drawPixels(all, COLOR_A);

      const rect: Vec2[] = [];
      for (let y = 2; y < 4; y++) {
        for (let x = 1; x < 4; x++) {
          rect.push({ x, y });
        }
      }
      buf.drawPixels(rect, COLOR_B);

      const positions = Fill.floodFill(
        buf,
        { x: 2, y: 3 },
        FILL_COLOR
      );

      assert.deepStrictEqual(
        sortPositions(positions),
        sortPositions(rect)
      );
    });

    test("does not leak to a same-colored diagonal neighbor (4-directional connectivity only)", () => {
      const buf = filledBuffer({ x: 2, y: 2 }, COLOR_B);
      buf.drawPixels([
        { x: 0, y: 0 },
        { x: 1, y: 1 }
      ], COLOR_A);

      const positions = Fill.floodFill(
        buf,
        { x: 0, y: 0 },
        FILL_COLOR
      );

      assert.deepStrictEqual(positions, [{ x: 0, y: 0 }]);
    });

    test("does not include a same-colored but disconnected region", () => {
      const buf = new PixelBuffer({
        size: { x: 5, y: 2 },
        maxSize: TEST_MAX_SIZE
      });
      const all: Vec2[] = [];
      for (let y = 0; y < 2; y++) {
        for (let x = 0; x < 5; x++) {
          all.push({ x, y });
        }
      }
      buf.drawPixels(all, COLOR_B);
      buf.drawPixels([
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 0 },
        { x: 1, y: 1 }
      ], COLOR_A);
      buf.drawPixels([
        { x: 3, y: 0 },
        { x: 3, y: 1 },
        { x: 4, y: 0 },
        { x: 4, y: 1 }
      ], COLOR_A);

      const positions = Fill.floodFill(
        buf,
        { x: 0, y: 0 },
        FILL_COLOR
      );

      assert.deepStrictEqual(
        sortPositions(positions),
        sortPositions([
          { x: 0, y: 0 },
          { x: 0, y: 1 },
          { x: 1, y: 0 },
          { x: 1, y: 1 }
        ])
      );
    });

    test("returns [] when the seed already matches fillColor (no-op)", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        defaultColor: COLOR_A,
        maxSize: TEST_MAX_SIZE
      });

      const positions = Fill.floodFill(
        buf,
        { x: 1, y: 1 },
        COLOR_A
      );

      assert.deepStrictEqual(positions, []);
    });

    test("returns [] when the seed is out of bounds", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: TEST_MAX_SIZE
      });

      assert.deepStrictEqual(
        Fill.floodFill(buf, { x: -1, y: 0 }, FILL_COLOR),
        []
      );
      assert.deepStrictEqual(
        Fill.floodFill(buf, { x: 0, y: 4 }, FILL_COLOR),
        []
      );
    });

    test("excludes pixel (0,0) when it differs from the flood-filled region", () => {
      const buf = new PixelBuffer({
        size: { x: 3, y: 3 },
        defaultColor: COLOR_A,
        maxSize: TEST_MAX_SIZE
      });
      buf.drawPixels([
        { x: 0, y: 0 }
      ], { ...COLOR_A, a: 0 });

      const positions = Fill.floodFill(
        buf,
        { x: 1, y: 1 },
        FILL_COLOR
      );

      assert.ok(!positions.some((p) => p.x === 0 && p.y === 0));
      assert.strictEqual(positions.length, 8);
    });
  });

  describe("floodFill with a mask", () => {
    test("treats zero mask entries as walls", () => {
      const buf = filledBuffer({ x: 4, y: 1 }, COLOR_A);
      const mask = Uint8Array.from([1, 1, 0, 1]);

      assert.deepStrictEqual(
        sortPositions(Fill.floodFill(buf, { x: 0, y: 0 }, FILL_COLOR, mask)),
        [{ x: 0, y: 0 }, { x: 1, y: 0 }]
      );
    });

    test("returns nothing when the seed is masked out", () => {
      const buf = filledBuffer({ x: 2, y: 1 }, COLOR_A);
      const mask = Uint8Array.from([0, 1]);

      assert.deepStrictEqual(
        Fill.floodFill(buf, { x: 0, y: 0 }, FILL_COLOR, mask),
        []
      );
    });
  });

  describe("connectedRegion", () => {
    test("returns [] when the seed is out of bounds", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: TEST_MAX_SIZE
      });

      assert.deepStrictEqual(
        Fill.connectedRegion(buf, { x: -1, y: 0 }),
        []
      );
    });
  });
});
