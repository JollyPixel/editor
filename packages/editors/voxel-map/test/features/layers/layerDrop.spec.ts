// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import type { JollyReparentDetail } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  canDropLayerRef,
  voxelLayerDropIndex
} from "../../../src/features/layers/layerDrop.ts";
import { layerRowId } from "../../../src/features/layers/layerTree.ts";

// CONSTANTS
const kGround = layerRowId({
  kind: "voxel-layer",
  name: "Ground"
});
const kDeco = layerRowId({
  kind: "voxel-layer",
  name: "Deco"
});
const kTriggers = layerRowId({
  kind: "object-layer",
  name: "Triggers"
});
const kSpawns = layerRowId({
  kind: "object-layer",
  name: "Spawns"
});
const kTriggerArea = layerRowId({
  kind: "object",
  layerName: "Triggers",
  objectId: "obj_1"
});
const kSpawnPoint = layerRowId({
  kind: "object",
  layerName: "Spawns",
  objectId: "obj_2"
});

describe("canDropLayerRef", () => {
  test("allows a voxel layer above or below another voxel layer", () => {
    for (const where of ["above", "below"] as const) {
      assert.equal(
        canDropLayerRef(drop(kDeco, kGround, where)),
        true,
        `dropping ${where} should be allowed`
      );
    }
  });

  test("refuses a voxel layer dropped inside another voxel layer", () => {
    assert.equal(
      canDropLayerRef(drop(kDeco, kGround, "inside")),
      false
    );
  });

  test("refuses a voxel layer anywhere near an object row", () => {
    for (const targetId of [kTriggers, kTriggerArea]) {
      for (const where of ["above", "inside", "below"] as const) {
        assert.equal(
          canDropLayerRef(drop(kDeco, targetId, where)),
          false,
          `dropping ${where} ${targetId} should be refused`
        );
      }
    }
  });

  test("allows an object inside an object layer it does not belong to", () => {
    assert.equal(
      canDropLayerRef(drop(kTriggerArea, kSpawns, "inside")),
      true
    );
  });

  test("refuses an object dropped inside the layer it already belongs to", () => {
    assert.equal(
      canDropLayerRef(drop(kTriggerArea, kTriggers, "inside")),
      false
    );
  });

  test("refuses an object above or below an object layer", () => {
    for (const where of ["above", "below"] as const) {
      assert.equal(
        canDropLayerRef(drop(kTriggerArea, kSpawns, where)),
        false,
        `dropping ${where} should be refused`
      );
    }
  });

  test("refuses an object onto another object, in either layer", () => {
    for (const where of ["above", "inside", "below"] as const) {
      assert.equal(
        canDropLayerRef(drop(kTriggerArea, kSpawnPoint, where)),
        false,
        `dropping ${where} should be refused`
      );
    }
  });

  test("refuses an object layer everywhere, since nothing reads its order", () => {
    for (const targetId of [kGround, kSpawns, kSpawnPoint]) {
      for (const where of ["above", "inside", "below"] as const) {
        assert.equal(
          canDropLayerRef(drop(kTriggers, targetId, where)),
          false,
          `dropping ${where} ${targetId} should be refused`
        );
      }
    }
  });

  test("refuses the whole drop when one moved row is not allowed", () => {
    assert.equal(
      canDropLayerRef({
        movedIds: [kDeco, kTriggers],
        targetId: kGround,
        where: "above"
      }),
      false
    );
  });
});

describe("voxelLayerDropIndex", () => {
  const stack = ["A", "B", "C", "D"];

  test("drops above a later layer, accounting for the vacated slot", () => {
    assert.equal(voxelLayerDropIndex(stack, "A", "C", "above"), 1);
  });

  test("drops below a later layer", () => {
    assert.equal(voxelLayerDropIndex(stack, "A", "C", "below"), 2);
  });

  test("drops above an earlier layer", () => {
    assert.equal(voxelLayerDropIndex(stack, "D", "B", "above"), 1);
  });

  test("drops below an earlier layer", () => {
    assert.equal(voxelLayerDropIndex(stack, "D", "B", "below"), 2);
  });

  test("resolves a drop onto an adjacent neighbour back to where it started", () => {
    assert.equal(voxelLayerDropIndex(stack, "B", "C", "above"), 1);
    assert.equal(voxelLayerDropIndex(stack, "B", "A", "below"), 1);
  });

  test("reaches either end of the stack", () => {
    assert.equal(voxelLayerDropIndex(stack, "D", "A", "above"), 0);
    assert.equal(voxelLayerDropIndex(stack, "A", "D", "below"), 3);
  });

  test("returns -1 for a name that is not in the stack", () => {
    assert.equal(voxelLayerDropIndex(stack, "A", "NoSuch", "above"), -1);
    assert.equal(voxelLayerDropIndex(stack, "NoSuch", "A", "above"), -1);
  });
});

function drop(
  movedId: string,
  targetId: string,
  where: JollyReparentDetail["where"]
): JollyReparentDetail {
  return {
    movedIds: [movedId],
    targetId,
    where
  };
}
