// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { placeSubmenu } from "../../../src/containers/context-menu/submenuPlacement.ts";

// CONSTANTS
const kPanel = {
  width: 100,
  height: 60
};
const kViewport = {
  width: 800,
  height: 600
};

function item(
  left: number,
  top: number
) {
  return {
    top,
    bottom: top + 20,
    left,
    right: left + 150
  };
}

describe("ContextMenu.placeSubmenu", () => {
  test("opens past the parent menu edge with its first item on the parent row", () => {
    assert.deepEqual(
      placeSubmenu({
        item: item(100, 200),
        panel: kPanel,
        viewport: kViewport,
        padding: 4,
        side: "right"
      }),
      {
        x: 254,
        y: 196,
        side: "right"
      }
    );
  });

  test("flips left when the right side has no room", () => {
    assert.deepEqual(
      placeSubmenu({
        item: item(600, 200),
        panel: kPanel,
        viewport: kViewport,
        padding: 4,
        side: "right"
      }),
      {
        x: 496,
        y: 196,
        side: "left"
      }
    );
  });

  test("keeps cascading left while it fits", () => {
    assert.equal(
      placeSubmenu({
        item: item(300, 200),
        panel: kPanel,
        viewport: kViewport,
        padding: 4,
        side: "left"
      }).side,
      "left"
    );
  });

  test("slides up to stay inside the viewport near the bottom", () => {
    assert.equal(
      placeSubmenu({
        item: item(100, 580),
        panel: kPanel,
        viewport: kViewport,
        padding: 4,
        side: "right"
      }).y,
      540
    );
  });
});
