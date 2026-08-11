// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  coordinateFromKey,
  RESIZE_DIRECTIONS
} from "../src/ResizeDirection.ts";

describe("ResizeDirection", () => {
  test("describes horizontal resizing", () => {
    assert.deepEqual(RESIZE_DIRECTIONS.left, {
      coordinate: "clientX",
      dimension: "width",
      fromStart: true,
      growKey: "ArrowRight",
      orientation: "vertical",
      shrinkKey: "ArrowLeft"
    });
    assert.deepEqual(RESIZE_DIRECTIONS.right, {
      coordinate: "clientX",
      dimension: "width",
      fromStart: false,
      growKey: "ArrowLeft",
      orientation: "vertical",
      shrinkKey: "ArrowRight"
    });
  });

  test("describes vertical resizing", () => {
    assert.deepEqual(RESIZE_DIRECTIONS.top, {
      coordinate: "clientY",
      dimension: "height",
      fromStart: true,
      growKey: "ArrowDown",
      orientation: "horizontal",
      shrinkKey: "ArrowUp"
    });
    assert.deepEqual(RESIZE_DIRECTIONS.bottom, {
      coordinate: "clientY",
      dimension: "height",
      fromStart: false,
      growKey: "ArrowUp",
      orientation: "horizontal",
      shrinkKey: "ArrowDown"
    });
  });

  test("maps grow and shrink keys onto pointer coordinates", () => {
    for (const definition of Object.values(RESIZE_DIRECTIONS)) {
      const grow = coordinateFromKey(
        definition,
        definition.growKey,
        8
      );
      const shrink = coordinateFromKey(
        definition,
        definition.shrinkKey,
        8
      );

      assert.equal(grow, definition.fromStart ? 8 : -8);
      assert.equal(shrink, definition.fromStart ? -8 : 8);
      assert.equal(coordinateFromKey(definition, "Enter", 8), null);
    }
  });
});
