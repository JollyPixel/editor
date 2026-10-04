// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  HistoryStack
} from "#src/history/HistoryStack.ts";
import type { RGBA8 } from "#src/types.ts";
import {
  HISTORY_TEXTURE_SIZE,
  makeHistoryBuffer
} from "../helpers/history/buffer.ts";
import { makeUvMap } from "../helpers/uv/map.ts";

// CONSTANTS
const kRed: RGBA8 = { r: 255, g: 0, b: 0, a: 255 };
const kBlue: RGBA8 = { r: 0, g: 0, b: 255, a: 255 };
const kWhite: RGBA8 = { r: 255, g: 255, b: 255, a: 255 };

describe("HistoryStack", () => {
  describe("stroke undo/redo", () => {
    test("undo restores the before-color; redo re-applies the after-color", () => {
      const buffer = makeHistoryBuffer();
      const stack = new HistoryStack(
        buffer,
        makeUvMap(HISTORY_TEXTURE_SIZE)
      );

      buffer.drawPixels([
        { x: 0, y: 0 }
      ], kRed);
      stack.push({
        action: "stroke",
        positions: [{ x: 0, y: 0 }],
        beforeColors: [kWhite],
        afterColor: kRed
      });
      assert.deepStrictEqual(
        buffer.samplePixel(0, 0),
        [255, 0, 0, 255]
      );

      stack.undo();
      assert.deepStrictEqual(
        buffer.samplePixel(0, 0),
        [255, 255, 255, 255]
      );
      assert.ok(!stack.canUndo);
      assert.ok(stack.canRedo);

      stack.redo();
      assert.deepStrictEqual(
        buffer.samplePixel(0, 0),
        [255, 0, 0, 255]
      );
      assert.ok(stack.canUndo);
      assert.ok(!stack.canRedo);
    });

    test("undo restores heterogeneous before-colors across multiple positions", () => {
      const buffer = makeHistoryBuffer();
      const stack = new HistoryStack(
        buffer,
        makeUvMap(HISTORY_TEXTURE_SIZE)
      );

      buffer.drawPixels([
        { x: 0, y: 0 },
        { x: 1, y: 0 }
      ], kRed);
      buffer.drawPixels([
        { x: 1, y: 0 }
      ], kBlue);

      stack.push({
        action: "stroke",
        positions: [
          { x: 0, y: 0 },
          { x: 1, y: 0 }
        ],
        beforeColors: [kRed, kBlue],
        afterColor: kWhite
      });
      buffer.drawPixels([
        { x: 0, y: 0 },
        { x: 1, y: 0 }
      ], kWhite);

      stack.undo();
      assert.deepStrictEqual(
        buffer.samplePixel(0, 0),
        [255, 0, 0, 255]
      );
      assert.deepStrictEqual(
        buffer.samplePixel(1, 0),
        [0, 0, 255, 255]
      );
    });

    test("undo() returns null when the stack is empty", () => {
      const stack = new HistoryStack(
        makeHistoryBuffer(),
        makeUvMap(HISTORY_TEXTURE_SIZE)
      );

      assert.strictEqual(stack.undo(), null);
    });

    test("redo() returns null when there is nothing to redo", () => {
      const stack = new HistoryStack(
        makeHistoryBuffer(),
        makeUvMap(HISTORY_TEXTURE_SIZE)
      );

      assert.strictEqual(stack.redo(), null);
    });
  });

  describe("select-edit undo/redo", () => {
    test("undo restores heterogeneous before-colors; redo re-applies heterogeneous after-colors", () => {
      const buffer = makeHistoryBuffer();
      const stack = new HistoryStack(
        buffer,
        makeUvMap(HISTORY_TEXTURE_SIZE)
      );

      buffer.drawPixels([
        { x: 0, y: 0 }
      ], kRed);
      buffer.drawPixels([
        { x: 1, y: 0 }
      ], kBlue);

      stack.push({
        action: "select-edit",
        positions: [
          { x: 0, y: 0 },
          { x: 1, y: 0 }
        ],
        beforeColors: [kWhite, kWhite],
        afterColors: [kRed, kBlue],
        oldRect: { x: 0, y: 0, width: 2, height: 1 },
        newRect: { x: 0, y: 0, width: 2, height: 1 },
        oldMask: [true, true],
        newMask: [true, true]
      });

      stack.undo();
      assert.deepStrictEqual(
        buffer.samplePixel(0, 0),
        [255, 255, 255, 255]
      );
      assert.deepStrictEqual(
        buffer.samplePixel(1, 0),
        [255, 255, 255, 255]
      );

      stack.redo();
      assert.deepStrictEqual(
        buffer.samplePixel(0, 0),
        [255, 0, 0, 255]
      );
      assert.deepStrictEqual(
        buffer.samplePixel(1, 0),
        [0, 0, 255, 255]
      );
    });
  });

  describe("resized / texture-replaced undo/redo", () => {
    test("undo restores the previous size and pixel content", () => {
      const buffer = makeHistoryBuffer();
      const stack = new HistoryStack(
        buffer,
        makeUvMap(HISTORY_TEXTURE_SIZE)
      );
      buffer.drawPixels([{ x: 0, y: 0 }], kBlue);
      buffer.drawPixels([{ x: 3, y: 3 }], kRed);
      const beforePixels = Uint8ClampedArray.from(
        buffer.pixels()
      );

      buffer.resize({ x: 2, y: 2 });
      buffer.drawPixels([{ x: 0, y: 0 }], kRed);
      const afterPixels = Uint8ClampedArray.from(
        buffer.pixels()
      );

      stack.push({
        action: "resized",
        beforeSize: { x: 4, y: 4 },
        beforePixels,
        afterSize: { x: 2, y: 2 },
        afterPixels
      });

      stack.undo();
      assert.deepStrictEqual(
        buffer.size(),
        { x: 4, y: 4 }
      );
      assert.deepStrictEqual(buffer.pixels(), beforePixels);
      assert.deepStrictEqual(
        buffer.samplePixel(3, 3),
        [255, 0, 0, 255]
      );

      stack.redo();
      assert.deepStrictEqual(
        buffer.size(),
        { x: 2, y: 2 }
      );
      assert.deepStrictEqual(buffer.pixels(), afterPixels);
      assert.deepStrictEqual(
        buffer.samplePixel(0, 0),
        [255, 0, 0, 255]
      );
    });
  });
});
