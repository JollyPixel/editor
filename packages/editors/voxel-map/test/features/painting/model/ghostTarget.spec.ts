// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  VoxelRotation,
  type VoxelCoord
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  resolveGhostTarget,
  type GhostTargetOptions
} from "../../../../src/features/painting/model/ghostTarget.ts";

// CONSTANTS
const kPlace = {
  x: 0,
  y: 1,
  z: 0
};
const kRemove = {
  x: 0,
  y: 0,
  z: 0
};

function optionsOf(
  patch: Partial<GhostTargetOptions> = {}
): GhostTargetOptions {
  return {
    size: 1,
    mode: "build",
    aim: {
      place: kPlace,
      remove: kRemove
    },
    stroke: null,
    paint: {
      blockId: 3,
      rotation: VoxelRotation.CCW90,
      flipY: true
    },
    occupied: (position: VoxelCoord) => position.y === 0,
    ...patch
  };
}

describe("resolveGhostTarget", () => {
  test("puts the ghost on the place cell with the brush orientation", () => {
    const target = resolveGhostTarget(optionsOf());

    assert.ok(target !== null);
    assert.deepEqual(target.position, kPlace);
    assert.equal(target.blockId, 3);
    assert.equal(target.transform.rotation, 1);
    assert.equal(target.transform.flipY, true);
    assert.equal(target.overlay, false);
  });

  test("overlays the aimed block in replace mode", () => {
    const target = resolveGhostTarget(optionsOf({ mode: "replace" }));

    assert.ok(target !== null);
    assert.deepEqual(target.position, kRemove);
    assert.equal(target.overlay, true);
  });

  test("shows nothing for a brush larger than one voxel", () => {
    assert.equal(resolveGhostTarget(optionsOf({ size: 2 })), null);
  });

  test("shows nothing without an aim", () => {
    assert.equal(resolveGhostTarget(optionsOf({ aim: null })), null);
  });

  test("skips an occupied place cell and an empty replace cell", () => {
    assert.equal(
      resolveGhostTarget(optionsOf({ occupied: () => true })),
      null
    );
    assert.equal(
      resolveGhostTarget(optionsOf({
        mode: "replace",
        occupied: () => false
      })),
      null
    );
  });

  test("keeps the frozen stroke orientation over the camera one", () => {
    const target = resolveGhostTarget(optionsOf({
      aim: null,
      stroke: {
        center: kPlace,
        paint: {
          blockId: 7,
          rotation: VoxelRotation.Deg180,
          flipY: false
        }
      }
    }));

    assert.ok(target !== null);
    assert.deepEqual(target.position, kPlace);
    assert.equal(target.blockId, 7);
    assert.equal(target.transform.rotation, 2);
    assert.equal(target.transform.flipY, false);
    assert.equal(target.overlay, false);
  });

  test("overlays a cell the stroke already painted", () => {
    const target = resolveGhostTarget(optionsOf({
      stroke: {
        center: kRemove,
        paint: optionsOf().paint
      }
    }));

    assert.ok(target !== null);
    assert.equal(target.overlay, true);
  });

  test("shows nothing during a remove stroke", () => {
    assert.equal(
      resolveGhostTarget(optionsOf({
        stroke: {
          center: kRemove,
          paint: undefined
        }
      })),
      null
    );
  });
});
