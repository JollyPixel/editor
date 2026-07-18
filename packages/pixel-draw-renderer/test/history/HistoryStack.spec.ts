// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  groupPositionsByColor,
  HistoryStack
} from "../../src/history/HistoryStack.ts";
import { PixelBuffer } from "../../src/buffer/PixelBuffer.ts";
import type { RGBA } from "../../src/types.ts";

// CONSTANTS
const kRed: RGBA = { r: 255, g: 0, b: 0, a: 255 };
const kBlue: RGBA = { r: 0, g: 0, b: 255, a: 255 };
const kWhite: RGBA = { r: 255, g: 255, b: 255, a: 255 };

function makeBuffer(): PixelBuffer {
  return new PixelBuffer({ size: { x: 4, y: 4 }, defaultColor: kWhite, maxSize: 8 });
}

describe("groupPositionsByColor", () => {
  test("groups positions sharing an identical RGBA into one bucket", () => {
    const positions = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
    const colors = [kRed, kBlue, kRed];

    const groups = groupPositionsByColor(positions, colors);

    assert.strictEqual(groups.length, 2);
    const redGroup = groups.find((g) => g.color.r === 255);
    const blueGroup = groups.find((g) => g.color.b === 255);
    assert.deepStrictEqual(redGroup?.positions, [{ x: 0, y: 0 }, { x: 2, y: 0 }]);
    assert.deepStrictEqual(blueGroup?.positions, [{ x: 1, y: 0 }]);
  });

  test("returns one group per position when every color is unique", () => {
    const positions = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    const colors = [kRed, kBlue];

    assert.strictEqual(groupPositionsByColor(positions, colors).length, 2);
  });
});

describe("HistoryStack", () => {
  describe("canUndo / canRedo", () => {
    test("both false on a fresh stack", () => {
      const stack = new HistoryStack(makeBuffer());

      assert.strictEqual(stack.canUndo, false);
      assert.strictEqual(stack.canRedo, false);
    });

    test("canUndo becomes true after a push", () => {
      const stack = new HistoryStack(makeBuffer());

      stack.push({
        action: "stroke",
        positions: [{ x: 0, y: 0 }],
        beforeColors: [kWhite],
        afterColor: kRed
      });

      assert.strictEqual(stack.canUndo, true);
      assert.strictEqual(stack.canRedo, false);
    });
  });

  describe("stroke undo/redo", () => {
    test("undo restores the before-color; redo re-applies the after-color", () => {
      const buffer = makeBuffer();
      const stack = new HistoryStack(buffer);

      buffer.drawPixels([{ x: 0, y: 0 }], kRed);
      stack.push({
        action: "stroke",
        positions: [{ x: 0, y: 0 }],
        beforeColors: [kWhite],
        afterColor: kRed
      });
      assert.deepStrictEqual(buffer.samplePixel(0, 0), [255, 0, 0, 255]);

      stack.undo();
      assert.deepStrictEqual(buffer.samplePixel(0, 0), [255, 255, 255, 255]);
      assert.strictEqual(stack.canUndo, false);
      assert.strictEqual(stack.canRedo, true);

      stack.redo();
      assert.deepStrictEqual(buffer.samplePixel(0, 0), [255, 0, 0, 255]);
      assert.strictEqual(stack.canUndo, true);
      assert.strictEqual(stack.canRedo, false);
    });

    test("undo restores heterogeneous before-colors across multiple positions", () => {
      const buffer = makeBuffer();
      const stack = new HistoryStack(buffer);

      buffer.drawPixels([{ x: 0, y: 0 }], kRed);
      buffer.drawPixels([{ x: 1, y: 0 }], kBlue);

      stack.push({
        action: "stroke",
        positions: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
        beforeColors: [kRed, kBlue],
        afterColor: kWhite
      });
      buffer.drawPixels([{ x: 0, y: 0 }, { x: 1, y: 0 }], kWhite);

      stack.undo();
      assert.deepStrictEqual(buffer.samplePixel(0, 0), [255, 0, 0, 255]);
      assert.deepStrictEqual(buffer.samplePixel(1, 0), [0, 0, 255, 255]);
    });

    test("undo() returns null when the stack is empty", () => {
      const stack = new HistoryStack(makeBuffer());

      assert.strictEqual(stack.undo(), null);
    });

    test("redo() returns null when there is nothing to redo", () => {
      const stack = new HistoryStack(makeBuffer());

      assert.strictEqual(stack.redo(), null);
    });
  });

  describe("resized / texture-replaced undo/redo", () => {
    test("undo restores the previous size and pixel content", () => {
      const buffer = makeBuffer();
      const stack = new HistoryStack(buffer);
      const beforePixels = Uint8ClampedArray.from(buffer.getPixels());

      buffer.setSize({ x: 2, y: 2 });
      const afterPixels = Uint8ClampedArray.from(buffer.getPixels());

      stack.push({
        action: "resized",
        beforeSize: { x: 4, y: 4 },
        beforePixels,
        afterSize: { x: 2, y: 2 },
        afterPixels
      });

      stack.undo();
      assert.deepStrictEqual(buffer.getSize(), { x: 4, y: 4 });

      stack.redo();
      assert.deepStrictEqual(buffer.getSize(), { x: 2, y: 2 });
    });
  });

  describe("push", () => {
    test("clears the redo stack", () => {
      const buffer = makeBuffer();
      const stack = new HistoryStack(buffer);

      stack.push({
        action: "stroke", positions: [{ x: 0, y: 0 }], beforeColors: [kWhite], afterColor: kRed
      });
      stack.undo();
      assert.strictEqual(stack.canRedo, true);

      stack.push({
        action: "stroke", positions: [{ x: 1, y: 0 }], beforeColors: [kWhite], afterColor: kBlue
      });
      assert.strictEqual(stack.canRedo, false);
    });

    test("evicts the oldest entry once past the configured limit", () => {
      const buffer = makeBuffer();
      const stack = new HistoryStack(buffer, { limit: 2 });

      for (let i = 0; i < 3; i++) {
        stack.push({
          action: "stroke", positions: [{ x: i, y: 0 }], beforeColors: [kWhite], afterColor: kRed
        });
      }

      // 3 pushed, limit 2 -> only 2 undos possible
      assert.notStrictEqual(stack.undo(), null);
      assert.notStrictEqual(stack.undo(), null);
      assert.strictEqual(stack.undo(), null);
    });

    test("defaults to a limit of 10", () => {
      const buffer = makeBuffer();
      const stack = new HistoryStack(buffer);

      for (let i = 0; i < 11; i++) {
        stack.push({
          action: "stroke", positions: [{ x: 0, y: 0 }], beforeColors: [kWhite], afterColor: kRed
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
      const stack = new HistoryStack(buffer);

      stack.push({
        action: "stroke", positions: [{ x: 0, y: 0 }], beforeColors: [kWhite], afterColor: kRed
      });
      stack.undo();
      assert.strictEqual(stack.canRedo, true);

      stack.clear();
      assert.strictEqual(stack.canUndo, false);
      assert.strictEqual(stack.canRedo, false);
    });
  });
});
