// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { clampToViewport } from "../../src/numeric/clampToViewport.ts";

describe("clampToViewport", () => {
  test("keeps a fitting pane fully inside the viewport", () => {
    assert.deepEqual(
      clampToViewport({
        x: 900,
        y: -20,
        rect: {
          width: 300,
          height: 200
        },
        viewport: {
          width: 1000,
          height: 800
        }
      }),
      {
        x: 700,
        y: 0
      }
    );
  });

  test("anchors an oversized width at the leading edge", () => {
    assert.deepEqual(
      clampToViewport({
        x: 40,
        y: 50,
        rect: {
          width: 1200,
          height: 200
        },
        viewport: {
          width: 1000,
          height: 800
        }
      }),
      {
        x: 0,
        y: 50
      }
    );
  });

  test("anchors an oversized height at the leading edge", () => {
    assert.deepEqual(
      clampToViewport({
        x: 40,
        y: 50,
        rect: {
          width: 300,
          height: 900
        },
        viewport: {
          width: 1000,
          height: 800
        }
      }),
      {
        x: 40,
        y: 0
      }
    );
  });
});
