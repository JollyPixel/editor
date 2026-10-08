// Import Node.js Dependencies
import assert from "node:assert/strict";
import test from "node:test";

// Import Internal Dependencies
import { anchorOrigin } from "../../src/geometry/anchoredPosition.ts";

test("Numeric.anchorOrigin", async(context) => {
  await context.test("is the anchor point inside a panel placed at it", () => {
    assert.deepEqual(
      anchorOrigin({
        anchor: {
          top: 40,
          bottom: 40,
          left: 30,
          right: 30
        },
        panel: {
          width: 50,
          height: 20
        },
        position: {
          x: 30,
          y: 40
        }
      }),
      {
        x: 0,
        y: 0
      }
    );
  });

  await context.test("is the bottom edge of a panel flipped above a point", () => {
    assert.deepEqual(
      anchorOrigin({
        anchor: {
          top: 90,
          bottom: 90,
          left: 30,
          right: 30
        },
        panel: {
          width: 50,
          height: 20
        },
        position: {
          x: 30,
          y: 70
        }
      }),
      {
        x: 0,
        y: 20
      }
    );
  });

  await context.test("follows a point a viewport clamp moved inside the panel", () => {
    assert.deepEqual(
      anchorOrigin({
        anchor: {
          top: 40,
          bottom: 40,
          left: 95,
          right: 95
        },
        panel: {
          width: 50,
          height: 20
        },
        position: {
          x: 50,
          y: 40
        }
      }),
      {
        x: 45,
        y: 0
      }
    );
  });

  await context.test("faces the anchor center from a panel below an element", () => {
    assert.deepEqual(
      anchorOrigin({
        anchor: {
          top: 10,
          bottom: 30,
          left: 20,
          right: 40
        },
        panel: {
          width: 40,
          height: 20
        },
        position: {
          x: 20,
          y: 34
        }
      }),
      {
        x: 10,
        y: 0
      }
    );
  });
});
