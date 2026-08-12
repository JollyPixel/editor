// Import Node.js Dependencies
import assert from "node:assert/strict";
import test from "node:test";

// Import Internal Dependencies
import { clampToViewport } from "../../src/geometry/clampToViewport.ts";

test("clampToViewport", async(context) => {
  await context.test("keeps a fitting pane fully inside the viewport", () => {
    assert.deepEqual(
      clampToViewport({
        x: 80,
        y: -10,
        rect: {
          width: 30,
          height: 20
        },
        viewport: {
          width: 100,
          height: 100
        }
      }),
      {
        x: 70,
        y: 0
      }
    );
  });

  await context.test("anchors an oversized width at the leading edge", () => {
    assert.deepEqual(
      clampToViewport({
        x: 20,
        y: 10,
        rect: {
          width: 120,
          height: 20
        },
        viewport: {
          width: 100,
          height: 100
        }
      }),
      {
        x: 0,
        y: 10
      }
    );
  });

  await context.test("anchors an oversized height at the leading edge", () => {
    assert.deepEqual(
      clampToViewport({
        x: 10,
        y: 20,
        rect: {
          width: 20,
          height: 120
        },
        viewport: {
          width: 100,
          height: 100
        }
      }),
      {
        x: 10,
        y: 0
      }
    );
  });
});
