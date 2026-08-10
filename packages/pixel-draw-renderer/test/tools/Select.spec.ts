// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Select } from "#src/tools/Select.ts";
import type { RGBA } from "#src/types.ts";

// CONSTANTS
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
const k2x3Snapshot: RGBA[] = [
  kColorA,
  kColorB,
  kColorC,
  kColorD,
  kColorE,
  kColorF
];
const kColorG: RGBA = { r: 70, g: 0, b: 0, a: 255 };
const kColorH: RGBA = { r: 80, g: 0, b: 0, a: 255 };
// 2 wide x 4 tall (even x even — no center-pivot rounding drift), row-major.
const k2x4Snapshot: RGBA[] = [
  kColorA,
  kColorB,
  kColorC,
  kColorD,
  kColorE,
  kColorF,
  kColorG,
  kColorH
];

describe("Select", () => {
  describe("rotate / flip (instance)", () => {
    function makeSelectedWith(
      rect: { x: number; y: number; width: number; height: number; },
      snapshot: RGBA[]
    ): Select {
      const tool = new Select();
      tool.startCreate({
        x: rect.x,
        y: rect.y
      });
      tool.updateCreate({
        x: rect.x + rect.width - 1,
        y: rect.y + rect.height - 1
      });
      tool.finishCreate(snapshot);

      return tool;
    }

    test("rotate is a no-op (null) outside 'selected'", () => {
      const tool = new Select();
      assert.strictEqual(tool.rotate(), null);
    });

    test("rotate swaps rect dimensions (center-pivoted) and rotates the snapshot", () => {
      const tool = makeSelectedWith({
        x: 5,
        y: 5,
        width: 2,
        height: 3
      }, k2x3Snapshot);

      const result = tool.rotate();

      assert.deepStrictEqual(result, {
        oldRect: { x: 5, y: 5, width: 2, height: 3 },
        newRect: { x: 5, y: 6, width: 3, height: 2 }
      });
      assert.deepStrictEqual(tool.rect, result!.newRect);
      assert.deepStrictEqual(tool.snapshot, [
        kColorE,
        kColorC,
        kColorA,
        kColorF,
        kColorD,
        kColorB
      ]);
      assert.strictEqual(tool.state, "selected");
    });

    test("rotate is repeatable — two rotations (180deg) reverse the row-major content", () => {
      // Even x even dims: center-pivot rounding never drifts, so the rect
      // returns to its exact original position/size after 2 rotations.
      const tool = makeSelectedWith({
        x: 0,
        y: 0,
        width: 2,
        height: 4
      }, k2x4Snapshot);

      tool.rotate();
      const second = tool.rotate();

      assert.deepStrictEqual(
        second!.newRect,
        { x: 0, y: 0, width: 2, height: 4 }
      );
      assert.deepStrictEqual(
        tool.snapshot,
        [...k2x4Snapshot].reverse()
      );
    });

    test("rotate applied 4 times returns to the exact original rect and content", () => {
      const tool = makeSelectedWith({
        x: 5,
        y: 5,
        width: 2,
        height: 4
      }, k2x4Snapshot);

      let last;
      for (let i = 0; i < 4; i++) {
        last = tool.rotate();
      }

      assert.deepStrictEqual(
        last!.newRect,
        { x: 5, y: 5, width: 2, height: 4 }
      );
      assert.deepStrictEqual(tool.snapshot, k2x4Snapshot);
    });

    test("flipHorizontal is a no-op (null) outside 'selected'", () => {
      const tool = new Select();
      assert.strictEqual(tool.flipHorizontal(), null);
    });

    test("flipHorizontal mirrors content left-right and leaves the rect unchanged", () => {
      const tool = makeSelectedWith({
        x: 1,
        y: 1,
        width: 2,
        height: 3
      }, k2x3Snapshot);

      const rect = tool.flipHorizontal();

      assert.deepStrictEqual(
        rect,
        { x: 1, y: 1, width: 2, height: 3 }
      );
      assert.deepStrictEqual(tool.rect, rect);
      assert.deepStrictEqual(
        tool.snapshot,
        [kColorB, kColorA, kColorD, kColorC, kColorF, kColorE]
      );
    });

    test("flipVertical is a no-op (null) outside 'selected'", () => {
      const tool = new Select();
      assert.strictEqual(tool.flipVertical(), null);
    });

    test("flipVertical mirrors content top-bottom and leaves the rect unchanged", () => {
      const tool = makeSelectedWith({
        x: 1,
        y: 1,
        width: 2,
        height: 3
      }, k2x3Snapshot);

      const rect = tool.flipVertical();

      assert.deepStrictEqual(rect, { x: 1, y: 1, width: 2, height: 3 });
      assert.deepStrictEqual(tool.rect, rect);
      assert.deepStrictEqual(
        tool.snapshot,
        [kColorE, kColorF, kColorC, kColorD, kColorA, kColorB]
      );
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

    test("finishCreate can replace the live rectangle with its final bounds", () => {
      const tool = new Select();
      tool.startCreate({ x: -2, y: -2 });
      tool.updateCreate({ x: 4, y: 4 });
      tool.finishCreate(
        new Array(9).fill(kRed),
        { x: 0, y: 0, width: 3, height: 3 }
      );

      assert.deepStrictEqual(
        tool.rect,
        { x: 0, y: 0, width: 3, height: 3 }
      );
      assert.strictEqual(tool.mask?.length, 9);
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

      assert.ok(tool.hitTest({ x: 2, y: 2 }));
    });

    test("false for a position outside the rect", () => {
      const tool = new Select();
      tool.startCreate({ x: 0, y: 0 });
      tool.finishCreate([kRed]);

      assert.ok(!tool.hitTest({ x: 5, y: 5 }));
    });

    test("false while not 'selected'", () => {
      const tool = new Select();
      tool.startCreate({ x: 0, y: 0 });

      assert.ok(!tool.hitTest({ x: 0, y: 0 }));
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
      assert.deepStrictEqual(
        tool.snapshot,
        new Array(4).fill(kRed)
      );
    });

    test("updateMove offsets the rect by the drag delta", () => {
      const tool = makeSelected();
      tool.startMove({ x: 1, y: 1 });
      const rect = tool.updateMove({ x: 4, y: 3 });

      assert.deepStrictEqual(
        rect,
        { x: 3, y: 2, width: 2, height: 2 }
      );
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

    test("an imported snapshot's first move has skipErase true — the original must survive", () => {
      const tool = new Select();
      tool.startCreate({ x: 0, y: 0 });
      tool.finishCreate([kRed]);
      const snapshot = tool.exportSnapshot()!;
      tool.importSnapshot(snapshot);
      tool.startMove({ x: 0, y: 0 });
      tool.updateMove({ x: 5, y: 5 });
      const result = tool.finishMove();

      assert.ok(result!.skipErase);
    });

    test("skipErase is consumed after the first real move — a second move erases normally", () => {
      const tool = new Select();
      tool.startCreate({ x: 0, y: 0 });
      tool.finishCreate([kRed]);
      const snapshot = tool.exportSnapshot()!;
      tool.importSnapshot(snapshot);

      tool.startMove({ x: 0, y: 0 });
      tool.updateMove({ x: 5, y: 5 });
      tool.finishMove();

      tool.startMove({ x: 5, y: 5 });
      tool.updateMove({ x: 9, y: 9 });
      const second = tool.finishMove();

      assert.ok(!second!.skipErase);
    });

    test("a click-only drag places a floating paste and consumes skipErase", () => {
      const tool = new Select();
      tool.startCreate({ x: 0, y: 0 });
      tool.finishCreate([kRed]);
      const snapshot = tool.exportSnapshot()!;
      tool.importSnapshot(snapshot);

      tool.startMove({ x: 0, y: 0 });
      tool.updateMove({ x: 0, y: 0 });
      const placement = tool.finishMove();
      assert.deepStrictEqual(placement, {
        source: { x: 0, y: 0, width: 1, height: 1 },
        dest: { x: 0, y: 0, width: 1, height: 1 },
        skipErase: true
      });

      tool.startMove({ x: 0, y: 0 });
      tool.updateMove({ x: 5, y: 5 });
      const result = tool.finishMove();

      assert.ok(!result!.skipErase);
    });

    test("a plain (non-pasted) selection's move never sets skipErase", () => {
      const tool = makeSelected();
      tool.startMove({ x: 1, y: 1 });
      tool.updateMove({ x: 4, y: 3 });

      const result = tool.finishMove();

      assert.ok(!result!.skipErase);
    });
  });

  describe("clear", () => {
    test("resets to idle and drops the active snapshot", () => {
      const tool = new Select();
      tool.startCreate({ x: 0, y: 0 });
      tool.finishCreate([kRed]);
      tool.clear();

      assert.strictEqual(tool.state, "idle");
      assert.strictEqual(tool.rect, null);
      assert.strictEqual(tool.snapshot, null);
    });
  });

  describe("markErased", () => {
    test("fills the snapshot with the given color, sized to the rect", () => {
      const tool = new Select();
      tool.startCreate({ x: 0, y: 0 });
      tool.updateCreate({ x: 1, y: 0 });
      tool.finishCreate([kRed, kRed]);

      const eraseColor: RGBA = {
        r: 255, g: 255, b: 255, a: 255
      };
      tool.markErased(eraseColor);

      assert.deepStrictEqual(tool.snapshot, [eraseColor, eraseColor]);
    });
  });

  describe("snapshot import / export", () => {
    test("export returns null without a selection", () => {
      const tool = new Select();
      assert.strictEqual(tool.exportSnapshot(), null);
    });

    test("import restores an exported rect and pixels as the active selection", () => {
      const tool = new Select();
      tool.startCreate({ x: 2, y: 2 });
      tool.finishCreate([kRed]);
      const snapshot = tool.exportSnapshot()!;

      tool.clear();
      tool.importSnapshot(snapshot);
      assert.strictEqual(tool.state, "selected");
      assert.deepStrictEqual(
        tool.rect,
        { x: 2, y: 2, width: 1, height: 1 }
      );
    });

    test("snapshot boundaries are defensively copied", () => {
      const tool = new Select();
      tool.startCreate({ x: 0, y: 0 });
      tool.finishCreate([kRed]);
      const snapshot = tool.exportSnapshot()!;
      tool.importSnapshot(snapshot);
      snapshot.pixels[0].r = 99;
      snapshot.mask[0] = false;

      assert.deepStrictEqual(tool.snapshot, [kRed]);
      assert.deepStrictEqual(tool.mask, [true]);
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
      tool.selectRegion(
        { x: 1, y: 1, width: 2, height: 2 },
        k2x3Snapshot.slice(0, 4),
        kMask
      );

      assert.strictEqual(tool.state, "selected");
      assert.deepStrictEqual(
        tool.rect,
        { x: 1, y: 1, width: 2, height: 2 }
      );
      assert.deepStrictEqual(tool.mask, kMask);
    });

    test("hitTest follows the mask, so holes are not grab handles", () => {
      const tool = new Select();
      tool.selectRegion(
        { x: 0, y: 0, width: 2, height: 2 },
        k2x3Snapshot.slice(0, 4),
        kMask
      );

      assert.ok(tool.hitTest({ x: 0, y: 0 }), "masked-in top-left");
      assert.ok(!tool.hitTest({ x: 1, y: 0 }), "masked-out top-right is a hole");
      assert.ok(!tool.hitTest({ x: 0, y: 1 }), "masked-out bottom-left is a hole");
      assert.ok(tool.hitTest({ x: 1, y: 1 }), "masked-in bottom-right");
      assert.ok(!tool.hitTest({ x: 2, y: 0 }), "outside the bounding rect entirely");
    });

    test("markErased only overwrites masked-in cells, leaving masked-out cells untouched", () => {
      const tool = new Select();
      tool.selectRegion(
        { x: 0, y: 0, width: 2, height: 2 },
        [kColorA, kColorB, kColorC, kColorD],
        kMask
      );

      const eraseColor: RGBA = {
        r: 255, g: 255, b: 255, a: 255
      };
      tool.markErased(eraseColor);

      assert.deepStrictEqual(
        tool.snapshot,
        [eraseColor, kColorB, kColorC, eraseColor]
      );
    });

    test("snapshot export/import round-trips the mask", () => {
      const tool = new Select();
      tool.selectRegion(
        { x: 3, y: 3, width: 2, height: 2 },
        [kColorA, kColorB, kColorC, kColorD],
        kMask
      );
      const snapshot = tool.exportSnapshot()!;
      tool.clear();
      tool.importSnapshot(snapshot);

      assert.deepStrictEqual(tool.mask, kMask);
    });

    test("rotate transforms the mask the same way it transforms the snapshot", () => {
      const tool = new Select();
      // 2x1 mask: left cell selected, right cell not.
      tool.selectRegion(
        { x: 0, y: 0, width: 2, height: 1 },
        [kColorA, kColorB],
        [true, false]
      );

      tool.rotate();

      assert.deepStrictEqual(tool.rect!.width, 1);
      assert.deepStrictEqual(tool.rect!.height, 2);
      assert.deepStrictEqual(
        tool.mask,
        Select.rotateMaskCW([true, false], 2, 1)
      );
    });

    test("flipHorizontal/flipVertical transform the mask the same way they transform the snapshot", () => {
      const tool = new Select();
      tool.selectRegion({
        x: 0, y: 0, width: 2, height: 2
      }, [kColorA, kColorB, kColorC, kColorD], kMask);

      tool.flipHorizontal();
      assert.deepStrictEqual(
        tool.mask,
        Select.flipMaskHorizontal(kMask, 2, 2)
      );

      tool.flipVertical();
      assert.deepStrictEqual(
        tool.mask,
        Select.flipMaskVertical(
          Select.flipMaskHorizontal(kMask, 2, 2),
          2,
          2
        )
      );
    });
  });
});
