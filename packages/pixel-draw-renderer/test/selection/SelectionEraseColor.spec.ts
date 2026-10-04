// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { SelectionEraseColor } from "#src/selection/SelectionEraseColor.ts";
import { PixelBuffer } from "#src/buffer/PixelBuffer.ts";
import type { RGBA8 } from "#src/types.ts";

// CONSTANTS
const kRed: RGBA8 = { r: 255, g: 0, b: 0, a: 255 };
const kBlue: RGBA8 = { r: 0, g: 0, b: 255, a: 255 };
const kWhite: RGBA8 = { r: 255, g: 255, b: 255, a: 255 };
const kTransparent: RGBA8 = { r: 0, g: 0, b: 0, a: 0 };

function createBuffer(
  size: number
): PixelBuffer {
  return new PixelBuffer({ size: { x: size, y: size }, maxSize: 32 });
}

describe("SelectionEraseColor", () => {
  test("an explicit color wins over the surrounding pixels", () => {
    const buffer = createBuffer(4);

    assert.deepStrictEqual(
      new SelectionEraseColor(kRed).resolve(buffer, { x: 1, y: 1, width: 1, height: 1 }),
      kRed
    );
  });

  test("picks the most frequent color in the ring around the rect, ignoring its interior", () => {
    const buffer = createBuffer(8);
    buffer.drawPixels([{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }], kRed);
    buffer.drawPixels([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 1, y: 4 },
      { x: 2, y: 4 },
      { x: 3, y: 4 }
    ], kBlue);

    assert.deepStrictEqual(
      new SelectionEraseColor().resolve(buffer, { x: 2, y: 2, width: 2, height: 2 }),
      kBlue
    );
  });

  test("breaks a tie in favor of the color met first along the ring", () => {
    const buffer = createBuffer(3);
    buffer.drawPixels([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }], kRed);
    buffer.drawPixels([{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 0, y: 1 }, { x: 2, y: 1 }], kBlue);

    assert.deepStrictEqual(
      new SelectionEraseColor().resolve(buffer, { x: 1, y: 1, width: 1, height: 1 }),
      kRed
    );
  });

  test("is transparent when the rect has no in-bounds neighbors", () => {
    assert.deepStrictEqual(
      new SelectionEraseColor().resolve(createBuffer(4), { x: 0, y: 0, width: 4, height: 4 }),
      kTransparent
    );
  });

  test("samples only in-bounds neighbors when the rect touches the texture edge", () => {
    assert.deepStrictEqual(
      new SelectionEraseColor().resolve(createBuffer(4), { x: 0, y: 0, width: 2, height: 2 }),
      kWhite
    );
  });
});
