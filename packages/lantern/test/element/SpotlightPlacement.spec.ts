// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CornerRadii } from "#src/element/spotlight/CornerRadii.ts";
import { Hole } from "#src/element/spotlight/Hole.ts";
import {
  SpotlightPlacement,
  type SpotlightView,
  type TargetAnchor
} from "#src/element/spotlight/SpotlightPlacement.ts";

// CONSTANTS
const kView: SpotlightView = {
  viewport: {
    width: 800,
    height: 600
  },
  card: {
    width: 200,
    height: 100
  },
  side: "below"
};
const kRounded = new CornerRadii(4, 4, 0, 0);

function anchor(
  left: number,
  top: number,
  right: number,
  bottom: number
): TargetAnchor {
  return {
    rect: {
      left,
      top,
      right,
      bottom
    },
    radii: kRounded
  };
}

describe("SpotlightPlacement", () => {
  test("pads a target clear of the viewport edges and rounds the corners around it", () => {
    const { hole, lit } = SpotlightPlacement.around(anchor(100, 100, 200, 150), kView);

    assert.equal(lit, true);
    assert.deepEqual(hole, new Hole({
      x: 94,
      y: 94,
      width: 112,
      height: 62,
      radii: new CornerRadii(10, 10, 6, 6)
    }));
  });

  const fitted: Array<[string, number, number, number, number]> = [
    ["touches the left edge", 0, 0, 200, 600],
    ["sits closer to the top than the padding", 100, 3, 200, 150],
    ["runs past the right edge", 700, 100, 820, 150],
    ["comes within the padding of the bottom", 100, 400, 200, 598]
  ];
  for (const [name, left, top, right, bottom] of fitted) {
    test(`fits the hole to a target that ${name}, keeping its corners`, () => {
      const { hole } = SpotlightPlacement.around(anchor(left, top, right, bottom), kView);

      assert.deepEqual(hole, new Hole({
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
        radii: kRounded
      }));
    });
  }

  test("places the card on the step's side of the padded hole", () => {
    const { card } = SpotlightPlacement.around(anchor(300, 100, 500, 150), kView);

    assert.deepEqual(card, {
      x: 300,
      y: 166
    });
  });

  test("centres the card and lights nothing without a target", () => {
    const { card, lit } = SpotlightPlacement.centred(kView);

    assert.equal(lit, false);
    assert.deepEqual(card, {
      x: 300,
      y: 250
    });
  });

  test("equals a placement built from the same target and view", () => {
    const placement = SpotlightPlacement.around(anchor(100, 100, 200, 150), kView);

    assert.equal(
      placement.equals(SpotlightPlacement.around(anchor(100, 100, 200, 150), kView)),
      true
    );
  });

  const moved: Array<[string, SpotlightPlacement]> = [
    ["the target moves", SpotlightPlacement.around(anchor(100, 100, 220, 150), kView)],
    ["the target's corners change", SpotlightPlacement.around({
      ...anchor(100, 100, 200, 150),
      radii: CornerRadii.SQUARE
    }, kView)],
    ["the card widens", SpotlightPlacement.around(anchor(100, 100, 200, 150), {
      ...kView,
      card: {
        width: 240,
        height: 100
      }
    })],
    ["only the viewport resizes", SpotlightPlacement.around(anchor(100, 100, 200, 150), {
      ...kView,
      viewport: {
        width: 900,
        height: 600
      }
    })],
    ["the target is lost", SpotlightPlacement.centred(kView)]
  ];
  for (const [name, other] of moved) {
    test(`differs once ${name}`, () => {
      const placement = SpotlightPlacement.around(anchor(100, 100, 200, 150), kView);

      assert.equal(placement.equals(other), false);
    });
  }
});
