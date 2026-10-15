// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  holeAround,
  type CornerRadii
} from "#src/element/spotlight.ts";

// CONSTANTS
const kViewport = {
  width: 800,
  height: 600
};
const kPadding = 6;
const kRounded: CornerRadii = [4, 4, 0, 0];

describe("holeAround", () => {
  test("pads a target clear of the viewport edges and rounds the corners around it", () => {
    const hole = holeAround(
      {
        left: 100,
        top: 100,
        right: 200,
        bottom: 150
      },
      kRounded,
      kViewport,
      kPadding
    );

    assert.deepEqual(hole, {
      x: 94,
      y: 94,
      width: 112,
      height: 62,
      radii: [10, 10, 6, 6]
    });
  });

  const fitted: Array<[string, number, number, number, number]> = [
    ["touches the left edge", 0, 0, 200, 600],
    ["sits closer to the top than the padding", 100, 3, 200, 150],
    ["runs past the right edge", 700, 100, 820, 150],
    ["comes within the padding of the bottom", 100, 400, 200, 598]
  ];
  for (const [name, left, top, right, bottom] of fitted) {
    test(`fits the hole to a target that ${name}, keeping its corners`, () => {
      const hole = holeAround(
        {
          left,
          top,
          right,
          bottom
        },
        kRounded,
        kViewport,
        kPadding
      );

      assert.deepEqual(hole, {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
        radii: kRounded
      });
    });
  }
});
