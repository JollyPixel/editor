// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  HistoryController,
  type HistoryState
} from "#src/history/HistoryController.ts";
import { PixelBuffer } from "#src/buffer/PixelBuffer.ts";
import { UVMap } from "#src/uv/UVMap.ts";
import type { RGBA } from "#src/types.ts";

// CONSTANTS
const kRed: RGBA = { r: 255, g: 0, b: 0, a: 255 };
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

describe("HistoryController", () => {
  describe("disabled (default)", () => {
    test("push/undo/redo are no-ops and canUndo/canRedo stay false", () => {
      const controller = new HistoryController(
        makeBuffer(),
        makeUvMap()
      );

      controller.push({
        action: "stroke",
        positions: [{ x: 0, y: 0 }],
        beforeColors: [kWhite],
        afterColor: kRed
      });

      assert.ok(!controller.enabled);
      assert.ok(!controller.canUndo);
      assert.strictEqual(controller.undo(), null);
      assert.ok(!controller.canRedo);
      assert.strictEqual(controller.redo(), null);
    });
  });

  describe("enabled", () => {
    test("push records an entry that undo/redo replay against the buffer", () => {
      const buffer = makeBuffer();
      const controller = new HistoryController(
        buffer,
        makeUvMap(),
        { enabled: true }
      );

      buffer.drawPixels([{ x: 0, y: 0 }], kRed);
      controller.push({
        action: "stroke",
        positions: [{ x: 0, y: 0 }],
        beforeColors: [kWhite],
        afterColor: kRed
      });
      assert.ok(controller.canUndo);

      const undone = controller.undo();
      assert.strictEqual(undone?.action, "stroke");
      assert.deepStrictEqual(
        buffer.samplePixel(0, 0),
        [255, 255, 255, 255]
      );
      assert.ok(!controller.canUndo);
      assert.ok(controller.canRedo);

      const redone = controller.redo();
      assert.strictEqual(redone?.action, "stroke");
      assert.deepStrictEqual(
        buffer.samplePixel(0, 0),
        [255, 0, 0, 255]
      );
      assert.ok(!controller.canRedo);
    });

    test("clear discards both stacks", () => {
      const controller = new HistoryController(
        makeBuffer(),
        makeUvMap(),
        { enabled: true }
      );

      controller.push({
        action: "stroke",
        positions: [{ x: 0, y: 0 }],
        beforeColors: [kWhite],
        afterColor: kRed
      });
      controller.undo();
      assert.ok(controller.canRedo);

      controller.clear();
      assert.ok(!controller.canUndo);
      assert.ok(!controller.canRedo);
    });

    test("limit bounds the undo stack", () => {
      const buffer = makeBuffer();
      const controller = new HistoryController(
        buffer,
        makeUvMap(),
        { enabled: true, limit: 1 }
      );

      controller.push({
        action: "stroke",
        positions: [{ x: 0, y: 0 }],
        beforeColors: [kWhite],
        afterColor: kRed
      });
      controller.push({
        action: "stroke",
        positions: [{ x: 1, y: 0 }],
        beforeColors: [kWhite],
        afterColor: kRed
      });

      assert.notStrictEqual(controller.undo(), null);
      assert.strictEqual(controller.undo(), null);
    });
  });

  describe("onChange", () => {
    test("fires after push, undo, redo, and clear — never on a no-op", () => {
      const states: HistoryState[] = [];
      const controller = new HistoryController(makeBuffer(), makeUvMap(), {
        enabled: true,
        onChange: (state) => states.push(state)
      });

      controller.push({
        action: "stroke",
        positions: [{ x: 0, y: 0 }],
        beforeColors: [kWhite],
        afterColor: kRed
      });
      assert.deepStrictEqual(
        states.at(-1),
        { canUndo: true, canRedo: false }
      );

      controller.undo();
      assert.deepStrictEqual(
        states.at(-1),
        { canUndo: false, canRedo: true }
      );

      controller.redo();
      assert.deepStrictEqual(
        states.at(-1),
        { canUndo: true, canRedo: false }
      );

      controller.clear();
      assert.deepStrictEqual(
        states.at(-1),
        { canUndo: false, canRedo: false }
      );

      assert.strictEqual(states.length, 4);

      controller.undo();
      controller.redo();
      assert.strictEqual(states.length, 4);
    });

    test("does not fire on a disabled controller", () => {
      const states: HistoryState[] = [];
      const controller = new HistoryController(makeBuffer(), makeUvMap(), {
        enabled: false,
        onChange: (state) => states.push(state)
      });

      controller.push({
        action: "stroke",
        positions: [{ x: 0, y: 0 }],
        beforeColors: [kWhite],
        afterColor: kRed
      });
      controller.undo();
      controller.redo();
      controller.clear();

      assert.strictEqual(states.length, 0);
    });
  });
});
