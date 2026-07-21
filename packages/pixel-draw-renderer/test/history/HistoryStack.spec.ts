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
import { PixelBuffer } from "#src/buffer/PixelBuffer.ts";
import { UVMap } from "#src/uv/UVMap.ts";
import type { RGBA } from "#src/types.ts";

// CONSTANTS
const kRed: RGBA = { r: 255, g: 0, b: 0, a: 255 };
const kBlue: RGBA = { r: 0, g: 0, b: 255, a: 255 };
const kWhite: RGBA = { r: 255, g: 255, b: 255, a: 255 };

function makeBuffer(): PixelBuffer {
  return new PixelBuffer({
    size: { x: 4, y: 4 },
    defaultColor: kWhite,
    maxSize: 8
  });
}

function makeUvMap(): UVMap {
  return new UVMap({ getCanvasSize: () => {
    return { x: 4, y: 4 };
  } });
}

describe("HistoryStack", () => {
  describe("canUndo / canRedo", () => {
    test("both false on a fresh stack", () => {
      const stack = new HistoryStack(
        makeBuffer(),
        makeUvMap()
      );

      assert.ok(!stack.canUndo);
      assert.ok(!stack.canRedo);
    });

    test("canUndo becomes true after a push", () => {
      const stack = new HistoryStack(
        makeBuffer(),
        makeUvMap()
      );

      stack.push({
        action: "stroke",
        positions: [{ x: 0, y: 0 }],
        beforeColors: [kWhite],
        afterColor: kRed
      });

      assert.ok(stack.canUndo);
      assert.ok(!stack.canRedo);
    });
  });

  describe("stroke undo/redo", () => {
    test("undo restores the before-color; redo re-applies the after-color", () => {
      const buffer = makeBuffer();
      const stack = new HistoryStack(
        buffer,
        makeUvMap()
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
      const buffer = makeBuffer();
      const stack = new HistoryStack(
        buffer,
        makeUvMap()
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
        makeBuffer(),
        makeUvMap()
      );

      assert.strictEqual(stack.undo(), null);
    });

    test("redo() returns null when there is nothing to redo", () => {
      const stack = new HistoryStack(
        makeBuffer(),
        makeUvMap()
      );

      assert.strictEqual(stack.redo(), null);
    });
  });

  describe("select-edit undo/redo", () => {
    test("undo restores heterogeneous before-colors; redo re-applies heterogeneous after-colors", () => {
      const buffer = makeBuffer();
      const stack = new HistoryStack(
        buffer,
        makeUvMap()
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
      const buffer = makeBuffer();
      const stack = new HistoryStack(
        buffer,
        makeUvMap()
      );
      const beforePixels = Uint8ClampedArray.from(
        buffer.pixels()
      );

      buffer.resize({ x: 2, y: 2 });
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

      stack.redo();
      assert.deepStrictEqual(
        buffer.size(),
        { x: 2, y: 2 }
      );
    });
  });

  describe("push", () => {
    test("clears the redo stack", () => {
      const buffer = makeBuffer();
      const stack = new HistoryStack(
        buffer,
        makeUvMap()
      );

      stack.push({
        action: "stroke",
        positions: [{ x: 0, y: 0 }],
        beforeColors: [kWhite],
        afterColor: kRed
      });
      stack.undo();
      assert.ok(stack.canRedo);

      stack.push({
        action: "stroke",
        positions: [{ x: 1, y: 0 }],
        beforeColors: [kWhite],
        afterColor: kBlue
      });
      assert.ok(!stack.canRedo);
    });

    test("evicts the oldest entry once past the configured limit", () => {
      const buffer = makeBuffer();
      const stack = new HistoryStack(
        buffer,
        makeUvMap(),
        { limit: 2 }
      );

      for (let i = 0; i < 3; i++) {
        stack.push({
          action: "stroke",
          positions: [{ x: i, y: 0 }],
          beforeColors: [kWhite],
          afterColor: kRed
        });
      }

      // 3 pushed, limit 2 -> only 2 undos possible
      assert.notStrictEqual(stack.undo(), null);
      assert.notStrictEqual(stack.undo(), null);
      assert.strictEqual(stack.undo(), null);
    });

    test("defaults to a limit of 10", () => {
      const buffer = makeBuffer();
      const stack = new HistoryStack(
        buffer,
        makeUvMap()
      );

      for (let i = 0; i < 11; i++) {
        stack.push({
          action: "stroke",
          positions: [{ x: 0, y: 0 }],
          beforeColors: [kWhite],
          afterColor: kRed
        });
      }

      let undoCount = 0;
      while (stack.undo() !== null) {
        undoCount++;
      }
      assert.strictEqual(undoCount, 10);
    });
  });

  describe("clear", () => {
    test("discards both stacks", () => {
      const buffer = makeBuffer();
      const stack = new HistoryStack(
        buffer,
        makeUvMap()
      );

      stack.push({
        action: "stroke",
        positions: [{ x: 0, y: 0 }],
        beforeColors: [kWhite],
        afterColor: kRed
      });
      stack.undo();
      assert.ok(stack.canRedo);

      stack.clear();
      assert.ok(!stack.canUndo);
      assert.ok(!stack.canRedo);
    });
  });
});
