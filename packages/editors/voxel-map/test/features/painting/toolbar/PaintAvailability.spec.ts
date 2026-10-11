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
  BRUSH_VIEW_ONLY_REASON,
  PaintAvailability
} from "../../../../src/features/painting/toolbar/PaintAvailability.ts";
import { MAP_CAPABILITIES } from "../../../../src/access/MapAccess.ts";

describe("PaintAvailability", () => {
  test("lets the brush paint on a voxel layer", () => {
    const availability = PaintAvailability.evaluate({
      voxelLayer: "Ground",
      lastVoxelLayer: "Ground"
    }, false, MAP_CAPABILITIES.full);

    assert.strictEqual(availability.blocked, false);
    assert.strictEqual(availability.reason, null);
    assert.strictEqual(availability.notice, null);
  });

  test("offers to resume the last voxel layer from an object layer", () => {
    const availability = PaintAvailability.evaluate({
      voxelLayer: null,
      lastVoxelLayer: "Roof"
    }, false, MAP_CAPABILITIES.full);

    assert.strictEqual(availability.reason, BRUSH_NO_LAYER_REASON);
    assert.deepEqual(availability.notice, {
      message: "Object layer selected",
      resumeLayer: "Roof"
    });
  });

  test("reports a map without any voxel layer", () => {
    const availability = PaintAvailability.evaluate({
      voxelLayer: null,
      lastVoxelLayer: null
    }, false, MAP_CAPABILITIES.full);

    assert.strictEqual(availability.reason, BRUSH_NO_LAYER_REASON);
    assert.deepEqual(availability.notice, {
      message: "No voxel layer to paint on",
      resumeLayer: null
    });
  });

  test("blocks the brush silently while suspended, even in an object context", () => {
    const availability = PaintAvailability.evaluate({
      voxelLayer: null,
      lastVoxelLayer: "Roof"
    }, true, MAP_CAPABILITIES.full);

    assert.strictEqual(availability.reason, BRUSH_SUSPENDED_REASON);
    assert.strictEqual(availability.notice, null);
  });

  test("tells a role that cannot change voxels that the map is view only", () => {
    const availability = PaintAvailability.evaluate({
      voxelLayer: "Ground",
      lastVoxelLayer: "Ground"
    }, true, MAP_CAPABILITIES.none);

    assert.strictEqual(availability.reason, BRUSH_VIEW_ONLY_REASON);
    assert.deepEqual(availability.notice, {
      message: "View only",
      resumeLayer: null
    });
  });

  test("equals compares the reason and the notice", () => {
    const selection = {
      voxelLayer: null,
      lastVoxelLayer: "Roof"
    };

    assert.ok(
      PaintAvailability.evaluate(selection, false, MAP_CAPABILITIES.full).equals(
        PaintAvailability.evaluate(selection, false, MAP_CAPABILITIES.full)
      )
    );
    assert.ok(
      !PaintAvailability.evaluate(selection, false, MAP_CAPABILITIES.full).equals(
        PaintAvailability.evaluate(selection, true, MAP_CAPABILITIES.full)
      )
    );
  });
});
