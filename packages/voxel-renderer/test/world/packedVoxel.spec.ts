// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  packVoxel,
  unpackVoxel,
  voxelBlockId,
  voxelTransform,
  MAX_BLOCK_ID,
  VOXEL_ABSENT
} from "../../src/world/packedVoxel.ts";
import { AIR_BLOCK_ID } from "../../src/blocks/BlockId.ts";
import { packTransform } from "../../src/utils/math.ts";

describe("VOXEL_ABSENT", () => {
  it("is negative so every packed voxel is distinguishable", () => {
    assert.equal(VOXEL_ABSENT, -1);
    assert.ok(packVoxel(1, 0) >= 0);
    assert.ok(packVoxel(MAX_BLOCK_ID, 0xFF) >= 0);
  });
});

describe("packVoxel / unpackVoxel", () => {
  it("round-trips block id and transform", () => {
    const cases = [
      [1, 0],
      [8, 3],
      [255, 31],
      [MAX_BLOCK_ID, 0]
    ] as const;

    for (const [blockId, transform] of cases) {
      const packed = packVoxel(blockId, transform);
      assert.equal(voxelBlockId(packed), blockId, `blockId ${blockId}`);
      assert.equal(voxelTransform(packed), transform, `transform ${transform}`);
      assert.deepEqual(unpackVoxel(packed), { blockId, transform });
    }
  });

  it("round-trips every value packTransform can produce", () => {
    for (const rotation of [0, 1, 2, 3] as const) {
      for (const flipX of [false, true]) {
        for (const flipZ of [false, true]) {
          for (const flipY of [false, true]) {
            const transform = packTransform(rotation, flipX, flipZ, flipY);
            const packed = packVoxel(42, transform);

            assert.equal(voxelBlockId(packed), 42);
            assert.equal(voxelTransform(packed), transform);
          }
        }
      }
    }
  });

  it("keeps the block id out of the transform bits", () => {
    assert.notEqual(packVoxel(1, 0), packVoxel(2, 1));
    assert.equal(voxelTransform(packVoxel(MAX_BLOCK_ID, 0)), 0);
    assert.equal(voxelBlockId(packVoxel(1, 0xFF)), 1);
  });

  it("stays a non-negative 31-bit integer at the top of the range", () => {
    const packed = packVoxel(MAX_BLOCK_ID, 0xFF);

    assert.ok(Number.isSafeInteger(packed));
    assert.ok(packed > 0 && packed < 2 ** 31);
  });

  it("throws rather than silently truncating an out-of-range block id", () => {
    assert.throws(
      () => packVoxel(MAX_BLOCK_ID + 1, 0),
      RangeError
    );
    assert.throws(
      () => packVoxel(-1, 0),
      RangeError
    );
  });

  it("refuses to store air, which has no packed form", () => {
    assert.throws(
      () => packVoxel(AIR_BLOCK_ID, 0),
      /reserved for air/
    );
  });
});
