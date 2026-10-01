// Import Node.js Dependencies
import assert from "node:assert/strict";
import test from "node:test";

// Import Internal Dependencies
import {
  anchorOrigin,
  anchoredPosition
} from "../../src/geometry/anchoredPosition.ts";

test("Numeric.anchoredPosition", async(context) => {
  await context.test("sits below the anchor, offset by the gap", () => {
    assert.deepEqual(
      anchoredPosition({
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
        viewport: {
          width: 100,
          height: 100
        },
        gap: 4
      }),
      {
        x: 20,
        y: 34
      }
    );
  });

  await context.test("flips above when the panel does not fit below", () => {
    assert.deepEqual(
      anchoredPosition({
        anchor: {
          top: 70,
          bottom: 90,
          left: 20,
          right: 40
        },
        panel: {
          width: 40,
          height: 30
        },
        viewport: {
          width: 100,
          height: 100
        },
        gap: 4
      }),
      {
        x: 20,
        y: 36
      }
    );
  });

  await context.test("stays below when neither side fits, then clamps it", () => {
    assert.deepEqual(
      anchoredPosition({
        anchor: {
          top: 20,
          bottom: 40,
          left: 20,
          right: 40
        },
        panel: {
          width: 40,
          height: 80
        },
        viewport: {
          width: 100,
          height: 100
        },
        gap: 4
      }),
      {
        x: 20,
        y: 20
      }
    );
  });

  await context.test("clamps a panel running past the right edge back inside", () => {
    assert.deepEqual(
      anchoredPosition({
        anchor: {
          top: 10,
          bottom: 30,
          left: 90,
          right: 100
        },
        panel: {
          width: 40,
          height: 20
        },
        viewport: {
          width: 100,
          height: 100
        },
        gap: 4
      }),
      {
        x: 60,
        y: 34
      }
    );
  });

  await context.test("anchors an oversized panel at zero rather than flipping it offscreen", () => {
    assert.deepEqual(
      anchoredPosition({
        anchor: {
          top: 50,
          bottom: 70,
          left: 20,
          right: 40
        },
        panel: {
          width: 120,
          height: 120
        },
        viewport: {
          width: 100,
          height: 100
        },
        gap: 4
      }),
      {
        x: 0,
        y: 0
      }
    );
  });

  await context.test("sits right of the anchor, offset by the gap", () => {
    assert.deepEqual(
      anchoredPosition({
        anchor: {
          top: 20,
          bottom: 40,
          left: 10,
          right: 30
        },
        panel: {
          width: 40,
          height: 20
        },
        viewport: {
          width: 100,
          height: 100
        },
        gap: 4,
        side: "right"
      }),
      {
        x: 34,
        y: 20
      }
    );
  });

  await context.test("flips left when the panel does not fit to the right", () => {
    assert.deepEqual(
      anchoredPosition({
        anchor: {
          top: 20,
          bottom: 40,
          left: 70,
          right: 90
        },
        panel: {
          width: 40,
          height: 20
        },
        viewport: {
          width: 100,
          height: 100
        },
        gap: 4,
        side: "right"
      }),
      {
        x: 26,
        y: 20
      }
    );
  });

  await context.test("centres a right-anchor panel vertically", () => {
    assert.deepEqual(
      anchoredPosition({
        anchor: {
          top: 30,
          bottom: 50,
          left: 10,
          right: 30
        },
        panel: {
          width: 40,
          height: 40
        },
        viewport: {
          width: 100,
          height: 100
        },
        gap: 4,
        side: "right",
        align: "center"
      }),
      {
        x: 34,
        y: 20
      }
    );
  });

  await context.test("centres an above-anchor panel and flips below", () => {
    assert.deepEqual(
      anchoredPosition({
        anchor: {
          top: 30,
          bottom: 50,
          left: 40,
          right: 60
        },
        panel: {
          width: 40,
          height: 20
        },
        viewport: {
          width: 100,
          height: 100
        },
        gap: 4,
        side: "above",
        align: "center"
      }),
      {
        x: 30,
        y: 6
      }
    );
  });
});

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
