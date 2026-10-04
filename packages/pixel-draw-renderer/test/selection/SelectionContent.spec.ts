// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { SelectionContent } from "#src/selection/SelectionContent.ts";
import { PixelBuffer } from "#src/buffer/PixelBuffer.ts";
import { filledArray } from "#src/utils/array.ts";
import type {
  RGBA8,
  SelectionRect
} from "#src/types.ts";
import {
  COLOR_A,
  COLOR_B,
  COLOR_C,
  COLOR_D,
  COLOR_E,
  COLOR_F,
  SNAPSHOT_2X3,
  SNAPSHOT_2X4
} from "../helpers/selection/snapshots.ts";

// CONSTANTS
const kRed: RGBA8 = { r: 255, g: 0, b: 0, a: 255 };
const kBlue: RGBA8 = { r: 0, g: 0, b: 255, a: 255 };
const kWhite: RGBA8 = { r: 255, g: 255, b: 255, a: 255 };
const kTransparent: RGBA8 = { r: 0, g: 0, b: 0, a: 0 };
const kMask = [true, false, false, true];
const kAsymmetricMask = [true, false, true, true, false, false];
const kPixels2x2 = [COLOR_A, COLOR_B, COLOR_C, COLOR_D];

function contentOf(
  rect: SelectionRect,
  pixels: RGBA8[],
  mask: boolean[] = filledArray(pixels.length, true)
): SelectionContent {
  return new SelectionContent({ rect, pixels, mask });
}

describe("SelectionContent", () => {
  describe("capture", () => {
    test("reads pixels in row-major order", () => {
      const buffer = new PixelBuffer({ size: { x: 4, y: 4 }, maxSize: 32 });
      buffer.drawPixels([{ x: 2, y: 1 }], kRed);
      buffer.drawPixels([{ x: 1, y: 2 }], kBlue);

      const content = SelectionContent.capture(buffer, { x: 1, y: 1, width: 2, height: 2 });

      assert.deepStrictEqual(content.pixels, [kWhite, kRed, kBlue, kWhite]);
      assert.deepStrictEqual(content.mask, [true, true, true, true]);
    });

    test("samples out-of-bounds positions as fully transparent", () => {
      const buffer = new PixelBuffer({ size: { x: 2, y: 2 }, maxSize: 32 });

      const { pixels } = SelectionContent.capture(buffer, { x: 1, y: 1, width: 2, height: 2 });

      assert.deepStrictEqual(pixels.slice(1), [kTransparent, kTransparent, kTransparent]);
    });
  });

  describe("parse", () => {
    test("rejects pixels or a mask that do not match the rect", () => {
      const rect = { x: 0, y: 0, width: 2, height: 1 };

      assert.strictEqual(SelectionContent.parse({ rect, pixels: [kRed], mask: [true, true] }), null);
      assert.strictEqual(SelectionContent.parse({ rect, pixels: [kRed, kRed], mask: [true] }), null);
    });

    test("rejects a mask that selects nothing", () => {
      assert.strictEqual(
        SelectionContent.parse({
          rect: { x: 0, y: 0, width: 1, height: 1 },
          pixels: [kRed],
          mask: [false]
        }),
        null
      );
    });

    test("copies its input so later caller mutations do not leak in", () => {
      const data = {
        rect: { x: 0, y: 0, width: 1, height: 1 },
        pixels: [{ ...kRed }],
        mask: [true]
      };
      const content = SelectionContent.parse(data);
      data.pixels[0].r = 99;
      data.rect.x = 5;

      assert.deepStrictEqual(content?.pixels, [kRed]);
      assert.strictEqual(content?.rect.x, 0);
    });

    test("round-trips through toJSON with its mask", () => {
      const content = contentOf({ x: 3, y: 3, width: 2, height: 2 }, kPixels2x2, kMask);

      assert.deepStrictEqual(SelectionContent.parse(content.toJSON())?.toJSON(), content.toJSON());
    });
  });

  test("the constructor throws on content that does not match its rect", () => {
    assert.throws(
      () => contentOf({ x: 0, y: 0, width: 2, height: 2 }, [kRed]),
      RangeError
    );
  });

  test("hitTest follows the mask, so holes are not grab handles", () => {
    const content = contentOf({ x: 0, y: 0, width: 2, height: 2 }, SNAPSHOT_2X3.slice(0, 4), kMask);

    assert.ok(content.hitTest({ x: 0, y: 0 }));
    assert.ok(!content.hitTest({ x: 1, y: 0 }));
    assert.ok(!content.hitTest({ x: 0, y: 1 }));
    assert.ok(content.hitTest({ x: 1, y: 1 }));
    assert.ok(!content.hitTest({ x: 2, y: 0 }));
  });

  test("positions lists only masked-in pixels in texture coordinates", () => {
    const content = contentOf({ x: 4, y: 2, width: 2, height: 2 }, SNAPSHOT_2X3.slice(0, 4), kMask);

    assert.deepStrictEqual([...content.positions()], [{ x: 4, y: 2 }, { x: 5, y: 3 }]);
  });

  test("movedTo keeps the size, pixels and mask", () => {
    const content = contentOf({ x: 0, y: 0, width: 2, height: 2 }, kPixels2x2, kMask);

    const moved = content.movedTo({ x: 7, y: 8 });

    assert.deepStrictEqual(moved.rect, { x: 7, y: 8, width: 2, height: 2 });
    assert.deepStrictEqual(moved.pixels, content.pixels);
    assert.deepStrictEqual(moved.mask, kMask);
  });

  test("erased only overwrites masked-in cells", () => {
    const content = contentOf({ x: 0, y: 0, width: 2, height: 2 }, kPixels2x2, kMask);

    assert.deepStrictEqual(content.erased(kWhite).pixels, [kWhite, COLOR_B, COLOR_C, kWhite]);
  });

  describe("transforms", () => {
    test("rotated swaps the rect dimensions around its center and rotates the pixels", () => {
      const content = contentOf({ x: 5, y: 5, width: 2, height: 3 }, SNAPSHOT_2X3);

      const rotated = content.rotated("cw");

      assert.deepStrictEqual(rotated.rect, { x: 5, y: 6, width: 3, height: 2 });
      assert.deepStrictEqual(rotated.pixels, [COLOR_E, COLOR_C, COLOR_A, COLOR_F, COLOR_D, COLOR_B]);
    });

    test("rotated four times returns to the original rect and pixels", () => {
      let content = contentOf({ x: 5, y: 5, width: 2, height: 4 }, SNAPSHOT_2X4);
      for (let turn = 0; turn < 4; turn++) {
        content = content.rotated("cw");
      }

      assert.deepStrictEqual(content.rect, { x: 5, y: 5, width: 2, height: 4 });
      assert.deepStrictEqual(content.pixels, SNAPSHOT_2X4);
    });

    test("rotated counter-clockwise undoes the pixels and mask of a clockwise turn", () => {
      const content = contentOf({ x: 1, y: 1, width: 2, height: 3 }, SNAPSHOT_2X3, kAsymmetricMask);

      const restored = content.rotated("cw").rotated("ccw");

      assert.deepStrictEqual(restored.pixels, content.pixels);
      assert.deepStrictEqual(restored.mask, content.mask);
    });

    test("rotated keeps a square footprint in place", () => {
      const content = contentOf({ x: 3, y: 4, width: 2, height: 2 }, SNAPSHOT_2X3.slice(0, 4));

      assert.deepStrictEqual(content.rotated("cw").rect, { x: 3, y: 4, width: 2, height: 2 });
    });

    test("rotated turns the mask with the pixels", () => {
      const content = contentOf({ x: 0, y: 0, width: 2, height: 3 }, SNAPSHOT_2X3, kAsymmetricMask);

      assert.deepStrictEqual(content.rotated("cw").mask, [false, true, true, false, true, false]);
    });

    test("flippedHorizontal mirrors pixels and mask left-right", () => {
      const content = contentOf({ x: 1, y: 1, width: 2, height: 3 }, SNAPSHOT_2X3, kAsymmetricMask);

      const flipped = content.flippedHorizontal();

      assert.deepStrictEqual(flipped.rect, { x: 1, y: 1, width: 2, height: 3 });
      assert.deepStrictEqual(flipped.pixels, [COLOR_B, COLOR_A, COLOR_D, COLOR_C, COLOR_F, COLOR_E]);
      assert.deepStrictEqual(flipped.mask, [false, true, true, true, false, false]);
    });

    test("flippedVertical mirrors pixels and mask top-bottom", () => {
      const content = contentOf({ x: 1, y: 1, width: 2, height: 3 }, SNAPSHOT_2X3, kAsymmetricMask);

      const flipped = content.flippedVertical();

      assert.deepStrictEqual(flipped.pixels, [COLOR_E, COLOR_F, COLOR_C, COLOR_D, COLOR_A, COLOR_B]);
      assert.deepStrictEqual(flipped.mask, [false, false, true, true, true, false]);
    });
  });
});
