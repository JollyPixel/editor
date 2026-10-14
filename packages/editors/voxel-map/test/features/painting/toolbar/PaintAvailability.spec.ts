// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  BRUSH_NO_BLOCK_REASON,
  BRUSH_NO_LAYER_REASON,
  BRUSH_SUSPENDED_REASON,
  BRUSH_VIEW_ONLY_REASON,
  PaintAvailability,
  type PaintConditions
} from "../../../../src/features/painting/toolbar/PaintAvailability.ts";
import { MAP_CAPABILITIES } from "../../../../src/access/MapAccess.ts";

function evaluate(
  conditions: Partial<PaintConditions>
): PaintAvailability {
  return PaintAvailability.evaluate({
    selection: {
      voxelLayer: "Ground",
      lastVoxelLayer: "Ground"
    },
    hasBlock: true,
    suspended: false,
    access: MAP_CAPABILITIES.full,
    ...conditions
  });
}

describe("PaintAvailability", () => {
  test("lets the brush paint on a voxel layer", () => {
    const availability = evaluate({});

    assert.strictEqual(availability.blocked, false);
    assert.strictEqual(availability.reason, null);
    assert.strictEqual(availability.notice, null);
  });

  test("offers to resume the last voxel layer from an object layer", () => {
    const availability = evaluate({
      selection: {
        voxelLayer: null,
        lastVoxelLayer: "Roof"
      }
    });

    assert.strictEqual(availability.reason, BRUSH_NO_LAYER_REASON);
    assert.deepEqual(availability.notice, {
      message: "Object layer selected",
      resumeLayer: "Roof"
    });
  });

  test("reports a map without any voxel layer", () => {
    const availability = evaluate({
      selection: {
        voxelLayer: null,
        lastVoxelLayer: null
      }
    });

    assert.strictEqual(availability.reason, BRUSH_NO_LAYER_REASON);
    assert.deepEqual(availability.notice, {
      message: "No voxel layer to paint on",
      resumeLayer: null
    });
  });

  test("reports a map without any block to paint with", () => {
    const availability = evaluate({
      hasBlock: false
    });

    assert.strictEqual(availability.reason, BRUSH_NO_BLOCK_REASON);
    assert.deepEqual(availability.notice, {
      message: "No block to paint with",
      resumeLayer: null
    });
  });

  test("reports the missing block before the missing voxel layer", () => {
    const availability = evaluate({
      selection: {
        voxelLayer: null,
        lastVoxelLayer: "Roof"
      },
      hasBlock: false
    });

    assert.strictEqual(availability.reason, BRUSH_NO_BLOCK_REASON);
  });

  test("blocks the brush silently while suspended, even without layer or block", () => {
    const availability = evaluate({
      selection: {
        voxelLayer: null,
        lastVoxelLayer: "Roof"
      },
      hasBlock: false,
      suspended: true
    });

    assert.strictEqual(availability.reason, BRUSH_SUSPENDED_REASON);
    assert.strictEqual(availability.notice, null);
  });

  test("tells a role that cannot change voxels that the map is view only", () => {
    const availability = evaluate({
      suspended: true,
      access: MAP_CAPABILITIES.none
    });

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
      evaluate({ selection }).equals(evaluate({ selection }))
    );
    assert.ok(
      !evaluate({ selection }).equals(evaluate({
        selection,
        suspended: true
      }))
    );
  });
});
