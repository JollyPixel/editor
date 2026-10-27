// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CanvasSize } from "../../../src/systems/rendering/CanvasSize.ts";

describe("Systems.Rendering.CanvasSize", () => {
  test("should keep its last size while the canvas is hidden then shown again", () => {
    const size = new CanvasSize();
    const committed: unknown[] = [];

    for (const [width, height] of [[800, 600], [0, 0], [800, 600], [800, 600]]) {
      size.fit(width, height);
      committed.push(size.commit());
    }

    assert.deepStrictEqual(committed, [
      { width: 800, height: 600 },
      null,
      null,
      null
    ]);
  });

  test("should commit once the shown canvas has a new size", () => {
    const size = new CanvasSize();

    size.fit(800, 600);
    size.commit();
    size.fit(0, 0);
    size.commit();
    size.fit(1024, 768);

    assert.deepStrictEqual(size.commit(), { width: 1024, height: 768 });
  });

  test("should letterbox the available area to the ratio", () => {
    const size = new CanvasSize();
    size.ratio = 16 / 9;

    size.fit(1000, 1000);
    const tall = size.commit();
    size.fit(2000, 900);
    const wide = size.commit();

    assert.deepStrictEqual(
      [tall, wide],
      [{ width: 1000, height: 563 }, { width: 1600, height: 900 }]
    );
  });
});
