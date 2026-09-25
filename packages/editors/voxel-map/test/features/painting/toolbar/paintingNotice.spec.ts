// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  paintingNoticeOf
} from "../../../../src/features/painting/toolbar/paintingNotice.ts";

describe("paintingNoticeOf", () => {
  test("shows nothing while a voxel layer is selected", () => {
    const notice = paintingNoticeOf({
      voxelLayer: "Ground",
      lastVoxelLayer: "Ground"
    });

    assert.strictEqual(notice, null);
  });

  test("offers to resume the last voxel layer in an object context", () => {
    const notice = paintingNoticeOf({
      voxelLayer: null,
      lastVoxelLayer: "Roof"
    });

    assert.deepEqual(notice, {
      message: "Object layer selected",
      resumeLayer: "Roof"
    });
  });

  test("asks for a voxel layer when the world has none", () => {
    const notice = paintingNoticeOf({
      voxelLayer: null,
      lastVoxelLayer: null
    });

    assert.deepEqual(notice, {
      message: "No voxel layer to paint on",
      resumeLayer: null
    });
  });
});
