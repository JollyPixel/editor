// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { anchoredPosition } from "../../src/numeric/anchoredPosition.ts";

// CONSTANTS
const kViewport = {
  width: 1000,
  height: 600
};
const kPanel = {
  width: 180,
  height: 200
};

describe("Numeric.anchoredPosition", () => {
  test("sits below the anchor, offset by the gap", () => {
    const placed = anchoredPosition({
      anchor: {
        top: 100,
        bottom: 120,
        left: 40
      },
      panel: kPanel,
      viewport: kViewport,
      gap: 4
    });

    assert.deepEqual(
      placed,
      {
        x: 40,
        y: 124
      }
    );
  });

  test("flips above when the panel does not fit below", () => {
    const placed = anchoredPosition({
      anchor: {
        top: 500,
        bottom: 520,
        left: 40
      },
      panel: kPanel,
      viewport: kViewport,
      gap: 4
    });

    assert.equal(
      placed.y,
      500 - 4 - 200
    );
  });

  test("stays below when neither side fits, then clamps into the viewport", () => {
    const placed = anchoredPosition({
      anchor: {
        top: 100,
        bottom: 500,
        left: 40
      },
      panel: kPanel,
      viewport: kViewport,
      gap: 4
    });

    assert.equal(
      placed.y,
      kViewport.height - kPanel.height
    );
  });

  test("clamps a panel running past the right edge back inside", () => {
    const placed = anchoredPosition({
      anchor: {
        top: 10,
        bottom: 30,
        left: 950
      },
      panel: kPanel,
      viewport: kViewport,
      gap: 4
    });

    assert.equal(
      placed.x,
      kViewport.width - kPanel.width
    );
  });

  test("anchors an oversized panel at zero rather than flipping it offscreen", () => {
    const placed = anchoredPosition({
      anchor: {
        top: 300,
        bottom: 320,
        left: 40
      },
      panel: {
        width: 180,
        height: 900
      },
      viewport: kViewport,
      gap: 4
    });

    assert.equal(placed.y, 0);
  });
});
