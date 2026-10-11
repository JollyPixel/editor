// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  BlockShapeRegistry,
  ShapeOccupancy,
  type BlockShapeID
} from "../../../../../src/document/blocks/shape/index.ts";
import {
  VoxelTransform,
  VOXEL_TRANSFORM_MASK
} from "../../../../../src/document/geometry/VoxelTransform.ts";

interface ComplementCase {
  shape: BlockShapeID;
  complement: BlockShapeID;
  transform: VoxelTransform;
}

// CONSTANTS
const kShapes = BlockShapeRegistry.createDefault();
const kUpsideDownTurned = new VoxelTransform({
  rotation: 2,
  flipY: true
});
const kUpsideDown = new VoxelTransform({
  flipY: true
});
const kComplements: readonly ComplementCase[] = [
  {
    shape: "stair",
    complement: "slabBeam",
    transform: kUpsideDown
  },
  {
    shape: "stairCornerInner",
    complement: "slabCorner",
    transform: kUpsideDown
  },
  {
    shape: "stairCornerOuter",
    complement: "slabNotch",
    transform: kUpsideDown
  },
  {
    shape: "rampCornerInner",
    complement: "rampTip",
    transform: VoxelTransform.Identity
  },
  {
    shape: "rampCornerOuter",
    complement: "rampValley",
    transform: VoxelTransform.Identity
  },
  {
    shape: "slabBottom",
    complement: "slabTop",
    transform: VoxelTransform.Identity
  },
  {
    shape: "ramp",
    complement: "ramp",
    transform: kUpsideDownTurned
  },
  {
    shape: "stairCornerPeak",
    complement: "stairCornerPeak",
    transform: kUpsideDownTurned
  }
];
const kTransforms = Array.from(
  { length: VOXEL_TRANSFORM_MASK + 1 },
  (_, packed) => VoxelTransform.fromPacked(packed)
);

describe("ShapeOccupancy", () => {
  for (const { shape, complement, transform } of kComplements) {
    it(`pairs ${shape} with ${complement} under every shared transform`, () => {
      for (const shared of kTransforms) {
        assert.ok(
          resolveOccupancy(shape, shared).complements(
            resolveOccupancy(complement, transform.followedBy(shared))
          ),
          `transform ${shared.packed}`
        );
      }
    });

    it(`pairs ${complement} with ${shape} symmetrically`, () => {
      assert.ok(
        resolveOccupancy(complement, transform).complements(
          resolveOccupancy(shape, VoxelTransform.Identity)
        )
      );
    });
  }

  it("rejects a shape paired with a copy of itself", () => {
    assert.equal(
      resolveOccupancy("slabBottom").complements(resolveOccupancy("slabBottom")),
      false
    );
    assert.equal(
      resolveOccupancy("ramp").complements(resolveOccupancy("ramp")),
      false
    );
  });

  it("rejects a mirrored half that lands on the same half", () => {
    assert.equal(
      resolveOccupancy("slabBottom").complements(
        resolveOccupancy("slabTop", kUpsideDown)
      ),
      false
    );
  });

  it("rejects pairs that leave part of the cell empty", () => {
    assert.equal(
      resolveOccupancy("pole").complements(resolveOccupancy("slabBottom")),
      false
    );
    assert.equal(
      resolveOccupancy("ramp").complements(resolveOccupancy("slabTop")),
      false
    );
  });

  it("rejects a cube with anything", () => {
    for (const id of kShapes.ids()) {
      assert.equal(
        resolveOccupancy("cube").complements(resolveOccupancy(id)),
        false,
        id
      );
    }
  });

  it("memoizes one occupancy per shape and transform", () => {
    assert.equal(
      resolveOccupancy("ramp", kUpsideDown),
      resolveOccupancy("ramp", kUpsideDown)
    );
  });
});

function resolveOccupancy(
  id: BlockShapeID,
  transform: VoxelTransform = VoxelTransform.Identity
): ShapeOccupancy {
  return ShapeOccupancy.fromShape(kShapes.get(id)!, transform);
}
