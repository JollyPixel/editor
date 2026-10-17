// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import type { JollyReparentDetail } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { MapLayers } from "../../../src/features/layers/MapLayers.ts";
import {
  ObjectLayerRef,
  ObjectRef,
  VoxelLayerRef
} from "../../../src/state/index.ts";

// CONSTANTS
const kGround = new VoxelLayerRef("Ground").key;
const kDeco = new VoxelLayerRef("Deco").key;
const kTriggers = new ObjectLayerRef("Triggers").key;
const kSpawns = new ObjectLayerRef("Spawns").key;
const kTriggerArea = new ObjectRef("Triggers", "obj_1").key;
const kSpawnPoint = new ObjectRef("Spawns", "obj_2").key;

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

describe("MapLayers.acceptsDrop", () => {
  test("allows a voxel layer above or below another voxel layer", () => {
    for (const where of ["above", "below"] as const) {
      assert.equal(
        MapLayers.acceptsDrop(drop(kDeco, kGround, where)),
        true,
        `dropping ${where} should be allowed`
      );
    }
  });

  test("refuses a voxel layer dropped inside another voxel layer", () => {
    assert.equal(
      MapLayers.acceptsDrop(drop(kDeco, kGround, "inside")),
      false
    );
  });

  test("refuses a voxel layer anywhere near an object row", () => {
    for (const targetId of [kTriggers, kTriggerArea]) {
      for (const where of ["above", "inside", "below"] as const) {
        assert.equal(
          MapLayers.acceptsDrop(drop(kDeco, targetId, where)),
          false,
          `dropping ${where} ${targetId} should be refused`
        );
      }
    }
  });

  test("allows an object inside an object layer it does not belong to", () => {
    assert.equal(
      MapLayers.acceptsDrop(drop(kTriggerArea, kSpawns, "inside")),
      true
    );
  });

  test("refuses an object dropped inside the layer it already belongs to", () => {
    assert.equal(
      MapLayers.acceptsDrop(drop(kTriggerArea, kTriggers, "inside")),
      false
    );
  });

  test("refuses an object above or below an object layer", () => {
    for (const where of ["above", "below"] as const) {
      assert.equal(
        MapLayers.acceptsDrop(drop(kTriggerArea, kSpawns, where)),
        false,
        `dropping ${where} should be refused`
      );
    }
  });

  test("refuses an object onto another object, in either layer", () => {
    for (const where of ["above", "inside", "below"] as const) {
      assert.equal(
        MapLayers.acceptsDrop(drop(kTriggerArea, kSpawnPoint, where)),
        false,
        `dropping ${where} should be refused`
      );
    }
  });

  test("refuses an object layer everywhere, since nothing reads its order", () => {
    for (const targetId of [kGround, kSpawns, kSpawnPoint]) {
      for (const where of ["above", "inside", "below"] as const) {
        assert.equal(
          MapLayers.acceptsDrop(drop(kTriggers, targetId, where)),
          false,
          `dropping ${where} ${targetId} should be refused`
        );
      }
    }
  });

  test("refuses the whole drop when one moved row is not allowed", () => {
    assert.equal(
      MapLayers.acceptsDrop({
        movedIds: [kDeco, kTriggers],
        targetId: kGround,
        where: "above"
      }),
      false
    );
  });
});
