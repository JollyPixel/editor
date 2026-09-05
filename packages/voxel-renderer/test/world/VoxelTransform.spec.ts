// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  VoxelTransform,
  VOXEL_TRANSFORM_MASK
} from "../../src/world/index.ts";

// CONSTANTS
const kRotations = [0, 1, 2, 3] as const;
const kBools = [false, true];

describe("VoxelTransform", () => {
  it("defaults to the identity transform", () => {
    const transform = new VoxelTransform();

    assert.equal(transform.packed, 0);
    assert.equal(transform.rotation, 0);
    assert.equal(transform.flipX, false);
    assert.equal(transform.flipZ, false);
    assert.equal(transform.flipY, false);
  });

  it("exposes Identity as the zero-packed transform", () => {
    assert.equal(VoxelTransform.Identity.packed, 0);
    assert.ok(VoxelTransform.Identity.equals(new VoxelTransform()));
  });

  it("encodes rotation in bits 0-1", () => {
    assert.equal(new VoxelTransform({ rotation: 1 }).packed, 0b001);
    assert.equal(new VoxelTransform({ rotation: 2 }).packed, 0b010);
    assert.equal(new VoxelTransform({ rotation: 3 }).packed, 0b011);
  });

  it("encodes flipX in bit 2", () => {
    assert.equal(new VoxelTransform({ flipX: true }).packed, 0b100);
  });

  it("encodes flipZ in bit 3", () => {
    assert.equal(new VoxelTransform({ flipZ: true }).packed, 0b1000);
  });

  it("encodes flipY in bit 4", () => {
    assert.equal(new VoxelTransform({ flipY: true }).packed, 0b10000);
  });

  it("encodes every flag simultaneously", () => {
    assert.equal(
      new VoxelTransform({
        rotation: 3,
        flipX: true,
        flipZ: true,
        flipY: true
      }).packed,
      0b11111
    );
  });

  it("wraps a rotation outside 0..3", () => {
    assert.equal(new VoxelTransform({ rotation: 4 }).rotation, 0);
    assert.equal(new VoxelTransform({ rotation: 7 }).rotation, 3);
  });

  it("keeps a wrapped rotation out of the flip bits", () => {
    assert.equal(new VoxelTransform({ rotation: 7 }).packed, 0b011);
  });

  it("is frozen", () => {
    assert.ok(Object.isFrozen(new VoxelTransform()));
  });

  it("serializes to its packed form", () => {
    assert.equal(new VoxelTransform({ rotation: 2, flipY: true }).toJSON(), 0b10010);
  });
});

describe("VoxelTransform.fromPacked", () => {
  it("round-trips all 32 rotation×flip combinations", () => {
    for (const rotation of kRotations) {
      for (const flipX of kBools) {
        for (const flipZ of kBools) {
          for (const flipY of kBools) {
            const label = `${rotation},${flipX},${flipZ},${flipY}`;
            const source = new VoxelTransform({
              rotation,
              flipX,
              flipZ,
              flipY
            });
            const result = VoxelTransform.fromPacked(source.packed);

            assert.equal(result.rotation, rotation, `rotation mismatch for ${label}`);
            assert.equal(result.flipX, flipX, `flipX mismatch for ${label}`);
            assert.equal(result.flipZ, flipZ, `flipZ mismatch for ${label}`);
            assert.equal(result.flipY, flipY, `flipY mismatch for ${label}`);
          }
        }
      }
    }
  });

  it("ignores bits above the transform mask", () => {
    const result = VoxelTransform.fromPacked(0b1111111 | ~VOXEL_TRANSFORM_MASK);

    assert.equal(result.packed, VOXEL_TRANSFORM_MASK);
  });

  it("interns instances, so equal packed values are identical", () => {
    assert.equal(
      VoxelTransform.fromPacked(0b10101),
      VoxelTransform.fromPacked(0b10101)
    );
  });
});

describe("VoxelTransform#equals", () => {
  it("is true for the same packed value built two ways", () => {
    const built = new VoxelTransform({ rotation: 1, flipZ: true });

    assert.ok(built.equals(VoxelTransform.fromPacked(0b1001)));
  });

  it("is false when a single flag differs", () => {
    const a = new VoxelTransform({ rotation: 1 });
    const b = new VoxelTransform({ rotation: 1, flipX: true });

    assert.equal(a.equals(b), false);
  });
});
