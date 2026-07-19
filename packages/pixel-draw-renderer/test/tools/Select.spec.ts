// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Select } from "../../src/tools/Select.ts";
import { PixelBuffer } from "../../src/buffer/PixelBuffer.ts";
import type { RGBA } from "../../src/types.ts";

// CONSTANTS
const kTestMaxSize = 32;
const kRed: RGBA = { r: 255, g: 0, b: 0, a: 255 };
const kColorA: RGBA = { r: 10, g: 0, b: 0, a: 255 };
const kColorB: RGBA = { r: 20, g: 0, b: 0, a: 255 };
const kColorC: RGBA = { r: 30, g: 0, b: 0, a: 255 };
const kColorD: RGBA = { r: 40, g: 0, b: 0, a: 255 };
const kColorE: RGBA = { r: 50, g: 0, b: 0, a: 255 };
const kColorF: RGBA = { r: 60, g: 0, b: 0, a: 255 };
// 2 wide x 3 tall, row-major:
// A B
// C D
// E F
const k2x3Snapshot: RGBA[] = [kColorA, kColorB, kColorC, kColorD, kColorE, kColorF];
const kColorG: RGBA = { r: 70, g: 0, b: 0, a: 255 };
const kColorH: RGBA = { r: 80, g: 0, b: 0, a: 255 };
// 2 wide x 4 tall (even x even — no center-pivot rounding drift), row-major.
const k2x4Snapshot: RGBA[] = [kColorA, kColorB, kColorC, kColorD, kColorE, kColorF, kColorG, kColorH];

describe("Select", () => {
  describe("normalizeRect (static)", () => {
    test("a === b yields a 1x1 rect", () => {
      assert.deepStrictEqual(
        Select.normalizeRect({ x: 3, y: 3 }, { x: 3, y: 3 }),
        { x: 3, y: 3, width: 1, height: 1 }
      );
    });

    test("normalizes regardless of drag direction", () => {
      assert.deepStrictEqual(
        Select.normalizeRect({ x: 5, y: 5 }, { x: 2, y: 1 }),
        { x: 2, y: 1, width: 4, height: 5 }
      );
      assert.deepStrictEqual(
        Select.normalizeRect({ x: 2, y: 1 }, { x: 5, y: 5 }),
        { x: 2, y: 1, width: 4, height: 5 }
      );
    });
  });

  describe("captureSnapshot (static)", () => {
    test("reads pixels in row-major order", () => {
      const buf = new PixelBuffer({ size: { x: 4, y: 4 }, maxSize: kTestMaxSize });
      buf.drawPixels([{ x: 1, y: 1 }], kRed);

      const pixels = Select.captureSnapshot(buf, { x: 1, y: 1, width: 2, height: 1 });

      assert.deepStrictEqual(pixels[0], kRed);
      assert.notDeepStrictEqual(pixels[1], kRed);
    });

    test("out-of-bounds positions sample as fully transparent", () => {
      const buf = new PixelBuffer({ size: { x: 2, y: 2 }, maxSize: kTestMaxSize });

      const pixels = Select.captureSnapshot(buf, { x: 1, y: 1, width: 2, height: 2 });

      // (2,1), (1,2), (2,2) are out of bounds; only (1,1) is real.
      assert.deepStrictEqual(pixels[1], { r: 0, g: 0, b: 0, a: 0 });
      assert.deepStrictEqual(pixels[2], { r: 0, g: 0, b: 0, a: 0 });
      assert.deepStrictEqual(pixels[3], { r: 0, g: 0, b: 0, a: 0 });
    });
  });

  describe("dominantBorderColor (static)", () => {
    const kFallback: RGBA = { r: 1, g: 2, b: 3, a: 4 };
    const kWhite: RGBA = { r: 255, g: 255, b: 255, a: 255 };

    test("returns the canvas's own default fill when the rect's border is untouched", () => {
      const buf = new PixelBuffer({ size: { x: 8, y: 8 }, maxSize: kTestMaxSize });

      assert.deepStrictEqual(
        Select.dominantBorderColor(buf, { x: 2, y: 2, width: 2, height: 2 }, kFallback),
        kWhite
      );
    });

    test("picks the most frequent color among the surrounding ring, ignoring the rect's own interior", () => {
      const buf = new PixelBuffer({ size: { x: 8, y: 8 }, maxSize: kTestMaxSize });
      // Paint the rect's interior red — must be ignored, it's not a neighbor.
      buf.drawPixels([{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }], kRed);
      // The ring around a (2,2,2,2) rect has 12 cells; paint 7 of them blue,
      // outnumbering the 5 still at the canvas's default white.
      const blue: RGBA = { r: 0, g: 0, b: 255, a: 255 };
      buf.drawPixels([
        { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 },
        { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }
      ], blue);

      assert.deepStrictEqual(
        Select.dominantBorderColor(buf, { x: 2, y: 2, width: 2, height: 2 }, kFallback),
        blue
      );
    });

    test("falls back when the rect has no in-bounds neighbors (it spans the whole texture)", () => {
      const buf = new PixelBuffer({ size: { x: 4, y: 4 }, maxSize: kTestMaxSize });

      assert.deepStrictEqual(
        Select.dominantBorderColor(buf, { x: 0, y: 0, width: 4, height: 4 }, kFallback),
        kFallback
      );
    });

    test("samples clipped neighbors correctly when the rect touches the texture edge", () => {
      const buf = new PixelBuffer({ size: { x: 4, y: 4 }, maxSize: kTestMaxSize });

      // Rect at the top-left corner: only its right and bottom borders have
      // in-bounds neighbors, all still the canvas default (white).
      assert.deepStrictEqual(
        Select.dominantBorderColor(buf, { x: 0, y: 0, width: 2, height: 2 }, kFallback),
        kWhite
      );
    });
  });

  describe("rotate/flip transforms (static)", () => {
    test("rotateRectCW swaps width/height and pivots on the rect's center (rounded)", () => {
      assert.deepStrictEqual(
        Select.rotateRectCW({ x: 5, y: 5, width: 2, height: 3 }),
        { x: 5, y: 6, width: 3, height: 2 }
      );
    });

    test("rotateRectCW on a square rect keeps the same footprint", () => {
      assert.deepStrictEqual(
        Select.rotateRectCW({ x: 3, y: 4, width: 5, height: 5 }),
        { x: 3, y: 4, width: 5, height: 5 }
      );
    });

    test("rotateSnapshotCW rotates a non-square grid 90 degrees clockwise", () => {
      // A B      E C A
      // C D  ->  F D B
      // E F
      assert.deepStrictEqual(
        Select.rotateSnapshotCW(k2x3Snapshot, 2, 3),
        [kColorE, kColorC, kColorA, kColorF, kColorD, kColorB]
      );
    });

    test("rotateSnapshotCW applied 4 times returns the original grid", () => {
      let snapshot = k2x3Snapshot;
      let width = 2;
      let height = 3;

      for (let i = 0; i < 4; i++) {
        snapshot = Select.rotateSnapshotCW(snapshot, width, height);
        [width, height] = [height, width];
      }

      assert.deepStrictEqual(snapshot, k2x3Snapshot);
      assert.strictEqual(width, 2);
      assert.strictEqual(height, 3);
    });

    test("flipSnapshotHorizontal mirrors each row left-right", () => {
      assert.deepStrictEqual(
        Select.flipSnapshotHorizontal(k2x3Snapshot, 2, 3),
        [kColorB, kColorA, kColorD, kColorC, kColorF, kColorE]
      );
    });

    test("flipSnapshotVertical mirrors rows top-bottom", () => {
      assert.deepStrictEqual(
        Select.flipSnapshotVertical(k2x3Snapshot, 2, 3),
        [kColorE, kColorF, kColorC, kColorD, kColorA, kColorB]
      );
    });
  });

  describe("rotate / flip (instance)", () => {
    function makeSelectedWith(
      rect: { x: number; y: number; width: number; height: number; },
      snapshot: RGBA[]
    ): Select {
      const tool = new Select();
      tool.startCreate({ x: rect.x, y: rect.y });
      tool.updateCreate({ x: rect.x + rect.width - 1, y: rect.y + rect.height - 1 });
      tool.finishCreate(snapshot);

      return tool;
    }

    test("rotate is a no-op (null) outside 'selected'", () => {
      const tool = new Select();
      assert.strictEqual(tool.rotate(), null);
    });

    test("rotate swaps rect dimensions (center-pivoted) and rotates the snapshot", () => {
      const tool = makeSelectedWith({ x: 5, y: 5, width: 2, height: 3 }, k2x3Snapshot);

      const result = tool.rotate();

      assert.deepStrictEqual(result, {
        oldRect: { x: 5, y: 5, width: 2, height: 3 },
        newRect: { x: 5, y: 6, width: 3, height: 2 }
      });
      assert.deepStrictEqual(tool.rect, result!.newRect);
      assert.deepStrictEqual(tool.snapshot, [kColorE, kColorC, kColorA, kColorF, kColorD, kColorB]);
      assert.strictEqual(tool.state, "selected");
    });

    test("rotate is repeatable — two rotations (180deg) reverse the row-major content", () => {
      // Even x even dims: center-pivot rounding never drifts, so the rect
      // returns to its exact original position/size after 2 rotations.
      const tool = makeSelectedWith({ x: 0, y: 0, width: 2, height: 4 }, k2x4Snapshot);

      tool.rotate();
      const second = tool.rotate();

      assert.deepStrictEqual(second!.newRect, { x: 0, y: 0, width: 2, height: 4 });
      assert.deepStrictEqual(tool.snapshot, [...k2x4Snapshot].reverse());
    });

    test("rotate applied 4 times returns to the exact original rect and content", () => {
      const tool = makeSelectedWith({ x: 5, y: 5, width: 2, height: 4 }, k2x4Snapshot);

      let last;
      for (let i = 0; i < 4; i++) {
        last = tool.rotate();
      }

      assert.deepStrictEqual(last!.newRect, { x: 5, y: 5, width: 2, height: 4 });
      assert.deepStrictEqual(tool.snapshot, k2x4Snapshot);
    });

    test("flipHorizontal is a no-op (null) outside 'selected'", () => {
      const tool = new Select();
      assert.strictEqual(tool.flipHorizontal(), null);
    });

    test("flipHorizontal mirrors content left-right and leaves the rect unchanged", () => {
      const tool = makeSelectedWith({ x: 1, y: 1, width: 2, height: 3 }, k2x3Snapshot);

      const rect = tool.flipHorizontal();

      assert.deepStrictEqual(rect, { x: 1, y: 1, width: 2, height: 3 });
      assert.deepStrictEqual(tool.rect, rect);
      assert.deepStrictEqual(tool.snapshot, [kColorB, kColorA, kColorD, kColorC, kColorF, kColorE]);
    });

    test("flipVertical is a no-op (null) outside 'selected'", () => {
      const tool = new Select();
      assert.strictEqual(tool.flipVertical(), null);
    });

    test("flipVertical mirrors content top-bottom and leaves the rect unchanged", () => {
      const tool = makeSelectedWith({ x: 1, y: 1, width: 2, height: 3 }, k2x3Snapshot);

      const rect = tool.flipVertical();

      assert.deepStrictEqual(rect, { x: 1, y: 1, width: 2, height: 3 });
      assert.deepStrictEqual(tool.rect, rect);
      assert.deepStrictEqual(tool.snapshot, [kColorE, kColorF, kColorC, kColorD, kColorA, kColorB]);
    });
  });

  describe("create flow", () => {
    test("starts idle", () => {
      const tool = new Select();
      assert.strictEqual(tool.state, "idle");
      assert.strictEqual(tool.rect, null);
      assert.strictEqual(tool.snapshot, null);
    });

    test("startCreate arms a 1x1 rect and enters 'creating'", () => {
      const tool = new Select();
      const rect = tool.startCreate({ x: 2, y: 2 });

      assert.strictEqual(tool.state, "creating");
      assert.deepStrictEqual(rect, { x: 2, y: 2, width: 1, height: 1 });
      assert.deepStrictEqual(tool.rect, rect);
    });

    test("updateCreate grows the rect from the fixed start corner", () => {
      const tool = new Select();
      tool.startCreate({ x: 2, y: 2 });
      const rect = tool.updateCreate({ x: 4, y: 5 });

      assert.deepStrictEqual(rect, { x: 2, y: 2, width: 3, height: 4 });
    });

    test("updateCreate is a no-op while not creating", () => {
      const tool = new Select();
      assert.strictEqual(tool.updateCreate({ x: 1, y: 1 }), null);
    });

    test("finishCreate stores the snapshot and enters 'selected'", () => {
      const tool = new Select();
      tool.startCreate({ x: 0, y: 0 });
      tool.finishCreate([kRed]);

      assert.strictEqual(tool.state, "selected");
      assert.deepStrictEqual(tool.snapshot, [kRed]);
    });

    test("finishCreate is a no-op while not creating", () => {
      const tool = new Select();
      tool.finishCreate([kRed]);
      assert.strictEqual(tool.state, "idle");
    });
  });

  describe("hitTest", () => {
    test("true for a position inside the selected rect", () => {
      const tool = new Select();
      tool.startCreate({ x: 0, y: 0 });
      tool.updateCreate({ x: 3, y: 3 });
      tool.finishCreate(new Array(16).fill(kRed));

      assert.strictEqual(tool.hitTest({ x: 2, y: 2 }), true);
    });

    test("false for a position outside the rect", () => {
      const tool = new Select();
      tool.startCreate({ x: 0, y: 0 });
      tool.finishCreate([kRed]);

      assert.strictEqual(tool.hitTest({ x: 5, y: 5 }), false);
    });

    test("false while not 'selected'", () => {
      const tool = new Select();
      tool.startCreate({ x: 0, y: 0 });

      assert.strictEqual(tool.hitTest({ x: 0, y: 0 }), false);
    });
  });

  describe("move flow", () => {
    function makeSelected(): Select {
      const tool = new Select();
      tool.startCreate({ x: 0, y: 0 });
      tool.updateCreate({ x: 1, y: 1 });
      tool.finishCreate(new Array(4).fill(kRed));

      return tool;
    }

    test("startMove requires 'selected'; no-op otherwise", () => {
      const tool = new Select();
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
      const tool = new Select();
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
      const tool = new Select();
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
      const tool = new Select();
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
      const tool = new Select();
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
      const tool = new Select();
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
      const tool = new Select();
      tool.copy();
      assert.strictEqual(tool.hasClipboard, false);
    });

    test("paste returns null when the clipboard is empty", () => {
      const tool = new Select();
      assert.strictEqual(tool.paste(), null);
    });

    test("paste restores the clipboard's rect/pixels and becomes the active selection", () => {
      const tool = new Select();
      tool.startCreate({ x: 2, y: 2 });
      tool.finishCreate([kRed]);
      tool.copy();

      tool.clear();
      const result = tool.paste();

      assert.deepStrictEqual(result, { rect: { x: 2, y: 2, width: 1, height: 1 }, pixels: [kRed], mask: [true] });
      assert.strictEqual(tool.state, "selected");
      assert.deepStrictEqual(tool.rect, { x: 2, y: 2, width: 1, height: 1 });
    });

    test("paste is repeatable — clipboard survives being pasted", () => {
      const tool = new Select();
      tool.startCreate({ x: 0, y: 0 });
      tool.finishCreate([kRed]);
      tool.copy();

      tool.paste();
      const second = tool.paste();

      assert.deepStrictEqual(second, { rect: { x: 0, y: 0, width: 1, height: 1 }, pixels: [kRed], mask: [true] });
    });
  });

  describe("shape (mask-aware) selection", () => {
    // 2 wide x 2 tall selection where only the top-left/bottom-right cells
    // are actually part of the shape (a checkerboard-ish mask, chosen so
    // rotate/flip visibly move the "gap" around).
    const kMask = [true, false, false, true];

    test("mask defaults to all-true after a rectangle-drag finishCreate", () => {
      const tool = new Select();
      tool.startCreate({ x: 0, y: 0 });
      tool.updateCreate({ x: 1, y: 0 });
      tool.finishCreate([kRed, kRed]);

      assert.deepStrictEqual(tool.mask, [true, true]);
    });

    test("mask is null while idle", () => {
      const tool = new Select();
      assert.strictEqual(tool.mask, null);
    });

    test("selectRegion enters 'selected' directly with the given rect/snapshot/mask", () => {
      const tool = new Select();
      tool.selectRegion({ x: 1, y: 1, width: 2, height: 2 }, k2x3Snapshot.slice(0, 4), kMask);

      assert.strictEqual(tool.state, "selected");
      assert.deepStrictEqual(tool.rect, { x: 1, y: 1, width: 2, height: 2 });
      assert.deepStrictEqual(tool.mask, kMask);
    });

    test("hitTest is true anywhere in the bounding rect, regardless of mask — grabbable like a rectangle", () => {
      const tool = new Select();
      tool.selectRegion({ x: 0, y: 0, width: 2, height: 2 }, k2x3Snapshot.slice(0, 4), kMask);

      assert.strictEqual(tool.hitTest({ x: 0, y: 0 }), true, "masked-in top-left");
      assert.strictEqual(tool.hitTest({ x: 1, y: 0 }), true, "masked-out top-right — still a hit");
      assert.strictEqual(tool.hitTest({ x: 0, y: 1 }), true, "masked-out bottom-left — still a hit");
      assert.strictEqual(tool.hitTest({ x: 1, y: 1 }), true, "masked-in bottom-right");
      assert.strictEqual(tool.hitTest({ x: 2, y: 0 }), false, "outside the bounding rect entirely");
    });

    test("markErased only overwrites masked-in cells, leaving masked-out cells untouched", () => {
      const tool = new Select();
      tool.selectRegion({ x: 0, y: 0, width: 2, height: 2 }, [kColorA, kColorB, kColorC, kColorD], kMask);

      const eraseColor: RGBA = { r: 255, g: 255, b: 255, a: 255 };
      tool.markErased(eraseColor);

      assert.deepStrictEqual(tool.snapshot, [eraseColor, kColorB, kColorC, eraseColor]);
    });

    test("copy/paste round-trip the mask through the clipboard", () => {
      const tool = new Select();
      tool.selectRegion({ x: 3, y: 3, width: 2, height: 2 }, [kColorA, kColorB, kColorC, kColorD], kMask);
      tool.copy();
      tool.clear();

      const result = tool.paste();

      assert.deepStrictEqual(result!.mask, kMask);
      assert.deepStrictEqual(tool.mask, kMask);
    });

    test("rotate transforms the mask the same way it transforms the snapshot", () => {
      const tool = new Select();
      // 2x1 mask: left cell selected, right cell not.
      tool.selectRegion({ x: 0, y: 0, width: 2, height: 1 }, [kColorA, kColorB], [true, false]);

      tool.rotate();

      assert.deepStrictEqual(tool.rect!.width, 1);
      assert.deepStrictEqual(tool.rect!.height, 2);
      assert.deepStrictEqual(tool.mask, Select.rotateMaskCW([true, false], 2, 1));
    });

    test("flipHorizontal/flipVertical transform the mask the same way they transform the snapshot", () => {
      const tool = new Select();
      tool.selectRegion({ x: 0, y: 0, width: 2, height: 2 }, [kColorA, kColorB, kColorC, kColorD], kMask);

      tool.flipHorizontal();
      assert.deepStrictEqual(tool.mask, Select.flipMaskHorizontal(kMask, 2, 2));

      tool.flipVertical();
      assert.deepStrictEqual(
        tool.mask,
        Select.flipMaskVertical(Select.flipMaskHorizontal(kMask, 2, 2), 2, 2)
      );
    });
  });

  describe("grid transform helpers (static, generic)", () => {
    test("rotateMaskCW rotates a boolean grid the same way rotateSnapshotCW rotates an RGBA grid", () => {
      // Same layout as k2x3Snapshot (A..F), true where the letter is one of A/D/E.
      const mask = [true, false, false, true, true, false];
      // rotateSnapshotCW(k2x3Snapshot) === [E, C, A, F, D, B] — same permutation, as booleans.
      assert.deepStrictEqual(
        Select.rotateMaskCW(mask, 2, 3),
        [true, false, true, false, true, false]
      );
    });

    test("flipMaskHorizontal/flipMaskVertical mirror a boolean grid", () => {
      const mask = [true, false, false, true];
      assert.deepStrictEqual(Select.flipMaskHorizontal(mask, 2, 2), [false, true, true, false]);
      assert.deepStrictEqual(Select.flipMaskVertical(mask, 2, 2), [false, true, true, false]);
    });
  });
});
