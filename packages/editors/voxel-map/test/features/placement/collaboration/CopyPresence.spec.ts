// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { VoxelTemplate } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { CopySource } from "../../../../src/features/placement/CopySource.ts";
import { CopyPresence } from "../../../../src/features/placement/collaboration/CopyPresence.ts";

function overTheWire(
  presence: CopyPresence
): CopyPresence | null {
  return CopyPresence.parse(JSON.parse(JSON.stringify(presence)));
}

describe("CopyPresence", () => {
  test("carries the copied voxels and their pivot over the wire", () => {
    const source = CopySource.of(new VoxelTemplate({
      id: "wall",
      name: "Wall",
      pivot: { x: 1, y: 0, z: 0 },
      positions: [0, 0, 0, 1, 0, 0, 1, 1, 0],
      voxels: [256, 512, 256],
      partners: [-1, 768, -1]
    }));

    const received = overTheWire(new CopyPresence(source))!;

    assert.equal(received.source.id, source.id);
    assert.deepEqual(received.source.snapshot.pivot, { x: 1, y: 0, z: 0 });
    assert.deepEqual(
      [...received.source.snapshot.localVoxels()],
      [...source.snapshot.localVoxels()]
    );
    assert.ok(received.equals(new CopyPresence(source)));
    assert.ok(received.describes(source.toRef()));
  });

  test("rejects a payload without a copy id or voxels", () => {
    const valid = {
      copyId: "copy-1",
      pivot: { x: 0, y: 0, z: 0 },
      positions: [0, 0, 0],
      voxels: [256],
      partners: [-1]
    };

    assert.notEqual(CopyPresence.parse(valid), null);
    for (const payload of [
      null,
      { ...valid, copyId: "" },
      { ...valid, voxels: [], positions: [], partners: [] }
    ]) {
      assert.equal(CopyPresence.parse(payload), null, JSON.stringify(payload));
    }
  });
});
