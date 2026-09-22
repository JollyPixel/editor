// Import Node.js Dependencies
import {
  describe,
  it
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { VoxelWorldJSON } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  SyncedVoxelMap,
  voxelMapDocumentKind
} from "#src/network/SyncedVoxelMap.ts";
import { VOXEL_MAP_KIND } from "#src/asset/kind.ts";
import { createMockRoom } from "../helpers/room.ts";

// CONSTANTS
const kSnapshot: VoxelWorldJSON = {
  version: 1,
  chunkSize: 16,
  tilesets: [{ id: "stone", src: "asset-stone", tileSize: 32 }],
  layers: []
};

describe("SyncedVoxelMap", () => {
  it("is ready once the first snapshot is loaded", async() => {
    const room = createMockRoom();
    const map = new SyncedVoxelMap(room);
    let settled = false;
    void map.ready.then(() => {
      settled = true;
    });

    await Promise.resolve();
    assert.equal(settled, false);
    assert.equal(map.loaded, false);

    room.simulateSnapshot(kSnapshot);
    await map.ready;

    assert.equal(map.loaded, true);
    assert.deepEqual(
      map.voxels.tilesets.definitions().map(({ id }) => id),
      ["stone"]
    );
    map.dispose();
  });

  it("forwards local edits and never leaves the room it was given", () => {
    const room = createMockRoom();
    const map = new SyncedVoxelMap(room);
    room.simulateSnapshot(kSnapshot);

    map.voxels.world.addLayer("Ground");

    assert.equal(room.sentCommands.length, 1);
    assert.equal(room.sentCommands[0].action, "added");

    map.dispose();

    assert.equal(room.left, false);
  });

  it("broadcasts a replacement world without applying it locally", () => {
    const room = createMockRoom();
    const map = new SyncedVoxelMap(room);
    room.simulateSnapshot(kSnapshot);

    map.replaceWorld({
      ...kSnapshot,
      tilesets: []
    });

    assert.equal(room.sentCommands.at(-1)?.action, "world-replace");
    assert.deepEqual(
      map.voxels.tilesets.definitions().map(({ id }) => id),
      ["stone"]
    );
    map.dispose();
  });
});

describe("voxelMapDocumentKind", () => {
  it("leases a synced map for the voxel-map asset kind", () => {
    const kind = voxelMapDocumentKind({ chunkSize: 8 });
    const room = createMockRoom();

    assert.equal(kind.kind, VOXEL_MAP_KIND);

    const lease = kind.createDocument(room);

    assert.ok(lease.document instanceof SyncedVoxelMap);
    assert.equal(lease.document.voxels.chunkSize, 8);
    lease.dispose();
  });
});
