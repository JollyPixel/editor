// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Internal Dependencies
import {
  resolveFocusHintPlacement
} from "../src/ui/focus/resolveFocusHintPlacement.ts";

// CONSTANTS
const kCanvas = {
  x: 100,
  y: 50,
  width: 800,
  height: 600
};
const kHint = {
  width: 120,
  height: 28
};
const kInset = 12;

describe("resolveFocusHintPlacement", () => {
  it("centers the hint on the top edge", () => {
    assert.deepEqual(
      resolveFocusHintPlacement("top-center", kCanvas, kHint, kInset),
      {
        x: 440,
        y: 62
      }
    );
  });

  it("anchors the hint to the top-left corner", () => {
    assert.deepEqual(
      resolveFocusHintPlacement("top-left", kCanvas, kHint, kInset),
      {
        x: 112,
        y: 62
      }
    );
  });

  it("anchors the hint to the top-right corner", () => {
    assert.deepEqual(
      resolveFocusHintPlacement("top-right", kCanvas, kHint, kInset),
      {
        x: 768,
        y: 62
      }
    );
  });

  it("anchors the hint to the middle-left edge", () => {
    assert.deepEqual(
      resolveFocusHintPlacement("middle-left", kCanvas, kHint, kInset),
      {
        x: 112,
        y: 336
      }
    );
  });

  it("centers the hint on both axes", () => {
    assert.deepEqual(
      resolveFocusHintPlacement("center", kCanvas, kHint, kInset),
      {
        x: 440,
        y: 336
      }
    );
  });

  it("anchors the hint to the middle-right edge", () => {
    assert.deepEqual(
      resolveFocusHintPlacement("middle-right", kCanvas, kHint, kInset),
      {
        x: 768,
        y: 336
      }
    );
  });

  it("anchors the hint to the bottom-left corner", () => {
    assert.deepEqual(
      resolveFocusHintPlacement("bottom-left", kCanvas, kHint, kInset),
      {
        x: 112,
        y: 610
      }
    );
  });

  it("centers the hint on the bottom edge", () => {
    assert.deepEqual(
      resolveFocusHintPlacement("bottom-center", kCanvas, kHint, kInset),
      {
        x: 440,
        y: 610
      }
    );
  });

  it("anchors the hint to the bottom-right corner", () => {
    assert.deepEqual(
      resolveFocusHintPlacement("bottom-right", kCanvas, kHint, kInset),
      {
        x: 768,
        y: 610
      }
    );
  });

  it("keeps the hint inside a canvas smaller than itself", () => {
    const canvas = {
      x: 0,
      y: 0,
      width: 60,
      height: 20
    };

    assert.deepEqual(
      resolveFocusHintPlacement("bottom-right", canvas, kHint, kInset),
      {
        x: 12,
        y: 12
      }
    );
    assert.deepEqual(
      resolveFocusHintPlacement("center", canvas, kHint, kInset),
      {
        x: 12,
        y: 12
      }
    );
  });

  it("offsets the placement by the canvas origin", () => {
    assert.deepEqual(
      resolveFocusHintPlacement(
        "top-left",
        {
          x: -25,
          y: -10,
          width: 800,
          height: 600
        },
        kHint,
        0
      ),
      {
        x: -25,
        y: -10
      }
    );
  });
});
