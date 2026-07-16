// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { SelectTool } from "../../src/input/SelectTool.ts";
import { PixelBuffer } from "../../src/buffer/PixelBuffer.ts";
import type { RGBA } from "../../src/types.ts";

// CONSTANTS
const kTestMaxSize = 32;
const kRed: RGBA = { r: 255, g: 0, b: 0, a: 255 };

describe("SelectTool", () => {
  describe("normalizeRect (static)", () => {
    test("a === b yields a 1x1 rect", () => {
      assert.deepStrictEqual(
        SelectTool.normalizeRect({ x: 3, y: 3 }, { x: 3, y: 3 }),
        { x: 3, y: 3, width: 1, height: 1 }
      );
    });

    test("normalizes regardless of drag direction", () => {
      assert.deepStrictEqual(
        SelectTool.normalizeRect({ x: 5, y: 5 }, { x: 2, y: 1 }),
        { x: 2, y: 1, width: 4, height: 5 }
      );
      assert.deepStrictEqual(
        SelectTool.normalizeRect({ x: 2, y: 1 }, { x: 5, y: 5 }),
        { x: 2, y: 1, width: 4, height: 5 }
      );
    });
  });

  describe("captureSnapshot (static)", () => {
    test("reads pixels in row-major order", () => {
      const buf = new PixelBuffer({ size: { x: 4, y: 4 }, maxSize: kTestMaxSize });
      buf.drawPixels([{ x: 1, y: 1 }], kRed);

      const pixels = SelectTool.captureSnapshot(buf, { x: 1, y: 1, width: 2, height: 1 });

      assert.deepStrictEqual(pixels[0], kRed);
      assert.notDeepStrictEqual(pixels[1], kRed);
    });

    test("out-of-bounds positions sample as fully transparent", () => {
      const buf = new PixelBuffer({ size: { x: 2, y: 2 }, maxSize: kTestMaxSize });

      const pixels = SelectTool.captureSnapshot(buf, { x: 1, y: 1, width: 2, height: 2 });

      // (2,1), (1,2), (2,2) are out of bounds; only (1,1) is real.
      assert.deepStrictEqual(pixels[1], { r: 0, g: 0, b: 0, a: 0 });
      assert.deepStrictEqual(pixels[2], { r: 0, g: 0, b: 0, a: 0 });
      assert.deepStrictEqual(pixels[3], { r: 0, g: 0, b: 0, a: 0 });
    });
  });

  describe("create flow", () => {
    test("starts idle", () => {
      const tool = new SelectTool();
      assert.strictEqual(tool.state, "idle");
      assert.strictEqual(tool.rect, null);
      assert.strictEqual(tool.snapshot, null);
    });

    test("startCreate arms a 1x1 rect and enters 'creating'", () => {
      const tool = new SelectTool();
      const rect = tool.startCreate({ x: 2, y: 2 });

      assert.strictEqual(tool.state, "creating");
      assert.deepStrictEqual(rect, { x: 2, y: 2, width: 1, height: 1 });
      assert.deepStrictEqual(tool.rect, rect);
    });

    test("updateCreate grows the rect from the fixed start corner", () => {
      const tool = new SelectTool();
      tool.startCreate({ x: 2, y: 2 });
      const rect = tool.updateCreate({ x: 4, y: 5 });

      assert.deepStrictEqual(rect, { x: 2, y: 2, width: 3, height: 4 });
    });

    test("updateCreate is a no-op while not creating", () => {
      const tool = new SelectTool();
      assert.strictEqual(tool.updateCreate({ x: 1, y: 1 }), null);
    });

    test("finishCreate stores the snapshot and enters 'selected'", () => {
      const tool = new SelectTool();
      tool.startCreate({ x: 0, y: 0 });
      tool.finishCreate([kRed]);

      assert.strictEqual(tool.state, "selected");
      assert.deepStrictEqual(tool.snapshot, [kRed]);
    });

    test("finishCreate is a no-op while not creating", () => {
      const tool = new SelectTool();
      tool.finishCreate([kRed]);
      assert.strictEqual(tool.state, "idle");
    });
  });

  describe("hitTest", () => {
    test("true for a position inside the selected rect", () => {
      const tool = new SelectTool();
      tool.startCreate({ x: 0, y: 0 });
      tool.updateCreate({ x: 3, y: 3 });
      tool.finishCreate(new Array(16).fill(kRed));

      assert.strictEqual(tool.hitTest({ x: 2, y: 2 }), true);
    });

    test("false for a position outside the rect", () => {
      const tool = new SelectTool();
      tool.startCreate({ x: 0, y: 0 });
      tool.finishCreate([kRed]);

      assert.strictEqual(tool.hitTest({ x: 5, y: 5 }), false);
    });

    test("false while not 'selected'", () => {
      const tool = new SelectTool();
      tool.startCreate({ x: 0, y: 0 });

      assert.strictEqual(tool.hitTest({ x: 0, y: 0 }), false);
    });
  });

  describe("move flow", () => {
    function makeSelected(): SelectTool {
      const tool = new SelectTool();
      tool.startCreate({ x: 0, y: 0 });
      tool.updateCreate({ x: 1, y: 1 });
      tool.finishCreate(new Array(4).fill(kRed));

      return tool;
    }

    test("startMove requires 'selected'; no-op otherwise", () => {
      const tool = new SelectTool();
      tool.startMove({ x: 0, y: 0 });
      assert.strictEqual(tool.state, "idle");
    });

    test("startMove enters 'moving' and keeps the snapshot", () => {
      const tool = makeSelected();
      tool.startMove({ x: 1, y: 1 });

      assert.strictEqual(tool.state, "moving");
      assert.deepStrictEqual(tool.snapshot, new Array(4).fill(kRed));
    });

    test("updateMove offsets the rect by the drag delta", () => {
      const tool = makeSelected();
      tool.startMove({ x: 1, y: 1 });
      const rect = tool.updateMove({ x: 4, y: 3 });

      assert.deepStrictEqual(rect, { x: 3, y: 2, width: 2, height: 2 });
      assert.deepStrictEqual(tool.rect, rect);
    });

    test("updateMove is a no-op while not moving", () => {
      const tool = makeSelected();
      assert.strictEqual(tool.updateMove({ x: 9, y: 9 }), null);
    });

    test("finishMove returns source/dest and re-enters 'selected' at dest", () => {
      const tool = makeSelected();
      tool.startMove({ x: 1, y: 1 });
      tool.updateMove({ x: 4, y: 3 });

      const result = tool.finishMove();

      assert.deepStrictEqual(result, {
        source: { x: 0, y: 0, width: 2, height: 2 },
        dest: { x: 3, y: 2, width: 2, height: 2 },
        skipErase: false
      });
      assert.strictEqual(tool.state, "selected");
      assert.deepStrictEqual(tool.rect, result!.dest);
    });

    test("finishMove returns null (but still resolves to 'selected') when the drag never moved the rect", () => {
      const tool = makeSelected();
      tool.startMove({ x: 1, y: 1 });
      tool.updateMove({ x: 1, y: 1 });

      const result = tool.finishMove();

      assert.strictEqual(result, null);
      assert.strictEqual(tool.state, "selected");
    });

    test("finishMove returns null while not moving", () => {
      const tool = makeSelected();
      assert.strictEqual(tool.finishMove(), null);
    });

    test("a paste's first move has skipErase true — the original must survive", () => {
      const tool = new SelectTool();
      tool.startCreate({ x: 0, y: 0 });
      tool.finishCreate([kRed]);
      tool.copy();

      tool.paste();
      tool.startMove({ x: 0, y: 0 });
      tool.updateMove({ x: 5, y: 5 });
      const result = tool.finishMove();

      assert.strictEqual(result!.skipErase, true);
    });

    test("skipErase is consumed after the first real move — a second move erases normally", () => {
      const tool = new SelectTool();
      tool.startCreate({ x: 0, y: 0 });
      tool.finishCreate([kRed]);
      tool.copy();
      tool.paste();

      tool.startMove({ x: 0, y: 0 });
      tool.updateMove({ x: 5, y: 5 });
      tool.finishMove();

      tool.startMove({ x: 5, y: 5 });
      tool.updateMove({ x: 9, y: 9 });
      const second = tool.finishMove();

      assert.strictEqual(second!.skipErase, false);
    });

    test("a click-only drag after a paste does not consume skipErase", () => {
      const tool = new SelectTool();
      tool.startCreate({ x: 0, y: 0 });
      tool.finishCreate([kRed]);
      tool.copy();
      tool.paste();

      // No-op drag: finishMove returns null, skipErase must still be pending.
      tool.startMove({ x: 0, y: 0 });
      tool.updateMove({ x: 0, y: 0 });
      assert.strictEqual(tool.finishMove(), null);

      tool.startMove({ x: 0, y: 0 });
      tool.updateMove({ x: 5, y: 5 });
      const result = tool.finishMove();

      assert.strictEqual(result!.skipErase, true);
    });

    test("a plain (non-pasted) selection's move never sets skipErase", () => {
      const tool = makeSelected();
      tool.startMove({ x: 1, y: 1 });
      tool.updateMove({ x: 4, y: 3 });

      const result = tool.finishMove();

      assert.strictEqual(result!.skipErase, false);
    });
  });

  describe("clear", () => {
    test("resets to idle, dropping rect and snapshot but not the clipboard", () => {
      const tool = new SelectTool();
      tool.startCreate({ x: 0, y: 0 });
      tool.finishCreate([kRed]);
      tool.copy();

      tool.clear();

      assert.strictEqual(tool.state, "idle");
      assert.strictEqual(tool.rect, null);
      assert.strictEqual(tool.snapshot, null);
      assert.strictEqual(tool.hasClipboard, true);
    });
  });

  describe("markErased", () => {
    test("fills the snapshot with the given color, sized to the rect", () => {
      const tool = new SelectTool();
      tool.startCreate({ x: 0, y: 0 });
      tool.updateCreate({ x: 1, y: 0 });
      tool.finishCreate([kRed, kRed]);

      const eraseColor: RGBA = { r: 255, g: 255, b: 255, a: 255 };
      tool.markErased(eraseColor);

      assert.deepStrictEqual(tool.snapshot, [eraseColor, eraseColor]);
    });
  });

  describe("copy / paste", () => {
    test("copy is a no-op without a selection", () => {
      const tool = new SelectTool();
      tool.copy();
      assert.strictEqual(tool.hasClipboard, false);
    });

    test("paste returns null when the clipboard is empty", () => {
      const tool = new SelectTool();
      assert.strictEqual(tool.paste(), null);
    });

    test("paste restores the clipboard's rect/pixels and becomes the active selection", () => {
      const tool = new SelectTool();
      tool.startCreate({ x: 2, y: 2 });
      tool.finishCreate([kRed]);
      tool.copy();

      tool.clear();
      const result = tool.paste();

      assert.deepStrictEqual(result, { rect: { x: 2, y: 2, width: 1, height: 1 }, pixels: [kRed] });
      assert.strictEqual(tool.state, "selected");
      assert.deepStrictEqual(tool.rect, { x: 2, y: 2, width: 1, height: 1 });
    });

    test("paste is repeatable — clipboard survives being pasted", () => {
      const tool = new SelectTool();
      tool.startCreate({ x: 0, y: 0 });
      tool.finishCreate([kRed]);
      tool.copy();

      tool.paste();
      const second = tool.paste();

      assert.deepStrictEqual(second, { rect: { x: 0, y: 0, width: 1, height: 1 }, pixels: [kRed] });
    });
  });
});
