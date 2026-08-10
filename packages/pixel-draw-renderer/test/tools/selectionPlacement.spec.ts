// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { placeSelection } from "#src/tools/selectionPlacement.ts";

// CONSTANTS
const kBounds = { x: 16, y: 16 };
const kViewCenter = { x: 8, y: 8 };

describe("placeSelection", () => {
  test("centres content on the cursor", () => {
    assert.deepStrictEqual(
      placeSelection(
        { width: 4, height: 2 },
        {
          cursor: { x: 8, y: 8 },
          viewCenter: kViewCenter,
          bounds: kBounds
        }
      ),
      { x: 6, y: 7, width: 4, height: 2 }
    );
  });

  test("falls back to the view centre without a cursor", () => {
    assert.deepStrictEqual(
      placeSelection(
        { width: 4, height: 4 },
        {
          cursor: null,
          viewCenter: { x: 3, y: 12 },
          bounds: kBounds
        }
      ),
      { x: 1, y: 10, width: 4, height: 4 }
    );
  });

  test("pulls content that would overhang an edge back inside", () => {
    assert.deepStrictEqual(
      placeSelection(
        { width: 6, height: 6 },
        {
          cursor: { x: 0, y: 15 },
          viewCenter: kViewCenter,
          bounds: kBounds
        }
      ),
      { x: 0, y: 10, width: 6, height: 6 },
      "left edge pinned to 0, bottom edge pinned to 16"
    );
  });

  test("pins content larger than the texture to the origin, keeping its size", () => {
    assert.deepStrictEqual(
      placeSelection(
        { width: 32, height: 20 },
        {
          cursor: { x: 12, y: 12 },
          viewCenter: kViewCenter,
          bounds: kBounds
        }
      ),
      { x: 0, y: 0, width: 32, height: 20 },
      "overflow is retained so it can be dragged into range"
    );
  });

  test("places odd sizes so the centre pixel lands under the cursor", () => {
    assert.deepStrictEqual(
      placeSelection(
        { width: 3, height: 3 },
        {
          cursor: { x: 5, y: 5 },
          viewCenter: kViewCenter,
          bounds: kBounds
        }
      ),
      { x: 4, y: 4, width: 3, height: 3 }
    );
  });

  test("a single pixel lands exactly on the cursor", () => {
    assert.deepStrictEqual(
      placeSelection(
        { width: 1, height: 1 },
        {
          cursor: { x: 11, y: 2 },
          viewCenter: kViewCenter,
          bounds: kBounds
        }
      ),
      { x: 11, y: 2, width: 1, height: 1 }
    );
  });
});
