// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { KindFilter } from "../../shared/KindFilter.ts";

describe("KindFilter", () => {
  test("hides and shows a kind again, saved in the same order whatever the edits", () => {
    const hidden = KindFilter.NONE
      .with("voxelmodel", false)
      .with("pixelart", false)
      .with("pixelart", false);

    assert.deepEqual(hidden.toJSON(), {
      hidden: ["pixelart", "voxelmodel"]
    });
    assert.deepEqual(
      [hidden.shows("pixelart"), hidden.shows("voxelmap")],
      [false, true]
    );
    assert.ok(hidden.with("voxelmodel", true).equals(new KindFilter(["pixelart"])));
  });
});
