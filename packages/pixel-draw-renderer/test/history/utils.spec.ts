// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  groupPositionsByColor
} from "#src/history/utils.ts";
import type { RGBA } from "#src/types.ts";

// CONSTANTS
const kRed: RGBA = { r: 255, g: 0, b: 0, a: 255 };
const kBlue: RGBA = { r: 0, g: 0, b: 255, a: 255 };

describe("groupPositionsByColor", () => {
  test("groups positions sharing an identical RGBA into one bucket", () => {
    const positions = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 }
    ];
    const colors = [
      kRed,
      kBlue,
      kRed
    ];

    const groups = groupPositionsByColor(
      positions,
      colors
    );

    assert.strictEqual(groups.length, 2);
    const redGroup = groups.find((g) => g.color.r === 255);
    const blueGroup = groups.find((g) => g.color.b === 255);
    assert.deepStrictEqual(
      redGroup?.positions,
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 }
      ]
    );
    assert.deepStrictEqual(
      blueGroup?.positions,
      [
        { x: 1, y: 0 }
      ]
    );
  });

  test("returns one group per position when every color is unique", () => {
    const positions = [
      { x: 0, y: 0 },
      { x: 1, y: 0 }
    ];
    const colors = [
      kRed,
      kBlue
    ];

    assert.strictEqual(
      groupPositionsByColor(positions, colors).length,
      2
    );
  });

  test("does not collide non-byte colors in the numeric fast path", () => {
    const positions = [
      { x: 0, y: 0 },
      { x: 1, y: 0 }
    ];
    const colors = [
      { r: 0, g: 1, b: 0, a: 255 },
      { r: 256, g: 0, b: 0, a: 255 }
    ];

    assert.strictEqual(
      groupPositionsByColor(positions, colors).length,
      2
    );
  });
});
