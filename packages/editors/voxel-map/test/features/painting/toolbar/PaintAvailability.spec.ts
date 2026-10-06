// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  BRUSH_NO_LAYER_REASON,
  BRUSH_SUSPENDED_REASON,
  PaintAvailability
} from "../../../../src/features/painting/toolbar/PaintAvailability.ts";

describe("PaintAvailability", () => {
  test("lets the brush paint on a voxel layer", () => {
    const availability = PaintAvailability.of({
      voxelLayer: "Ground",
      lastVoxelLayer: "Ground"
    }, false);

    assert.strictEqual(availability.blocked, false);
    assert.strictEqual(availability.reason, null);
    assert.strictEqual(availability.notice, null);
  });

  test("offers to resume the last voxel layer from an object layer", () => {
    const availability = PaintAvailability.of({
      voxelLayer: null,
      lastVoxelLayer: "Roof"
    }, false);

    assert.strictEqual(availability.reason, BRUSH_NO_LAYER_REASON);
    assert.deepEqual(availability.notice, {
      message: "Object layer selected",
      resumeLayer: "Roof"
    });
  });

  test("reports a map without any voxel layer", () => {
    const availability = PaintAvailability.of({
      voxelLayer: null,
      lastVoxelLayer: null
    }, false);

    assert.strictEqual(availability.reason, BRUSH_NO_LAYER_REASON);
    assert.deepEqual(availability.notice, {
      message: "No voxel layer to paint on",
      resumeLayer: null
    });
  });

  test("blocks the brush silently while suspended, even in an object context", () => {
    const availability = PaintAvailability.of({
      voxelLayer: null,
      lastVoxelLayer: "Roof"
    }, true);

    assert.strictEqual(availability.reason, BRUSH_SUSPENDED_REASON);
    assert.strictEqual(availability.notice, null);
  });

  test("equals compares the reason and the notice", () => {
    const selection = {
      voxelLayer: null,
      lastVoxelLayer: "Roof"
    };

    assert.ok(
      PaintAvailability.of(selection, false).equals(
        PaintAvailability.of(selection, false)
      )
    );
    assert.ok(
      !PaintAvailability.of(selection, false).equals(
        PaintAvailability.of(selection, true)
      )
    );
  });
});
