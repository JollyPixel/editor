// Import Node.js Dependencies
import {
  describe,
  it
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  VOXEL_WORLD_VERSION,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  SyncedVoxelMap,
  voxelMapDocumentKind
} from "#src/network/SyncedVoxelMap.ts";
import { VOXEL_MAP_KIND } from "#src/asset/voxelMap.ts";
import { createMockRoom } from "../helpers/room.ts";
import { mapHistory } from "../helpers/history.ts";

// CONSTANTS
const kSnapshot: VoxelWorldJSON = {
  version: VOXEL_WORLD_VERSION,
  chunkSize: 16,
  blocksets: [{ id: "stone", src: "asset-stone", tileSize: 32 }],
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
      map.voxels.blocksets.definitions().map(({ id }) => id),
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

  it("confirms each local command to its history when the server echoes it", () => {
    const room = createMockRoom();
    const map = new SyncedVoxelMap(room);
    room.simulateSnapshot(kSnapshot);
    map.voxels.world.addLayer("Ground");
    mapHistory(map.edits);
    const confirmed: string[] = [];
    map.edits.receipts.on("confirmed", (change) => confirmed.push(change.command.action));

    map.voxels.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: 1 });
    room.simulateCommand(room.sentCommands.at(-1)!);

    assert.deepEqual(confirmed, ["added", "voxel-set"]);
    map.dispose();
  });

  it("broadcasts a replacement world without applying it locally", () => {
    const room = createMockRoom();
    const map = new SyncedVoxelMap(room);
    room.simulateSnapshot(kSnapshot);

    map.replaceWorld({
      ...kSnapshot,
      blocksets: []
    });

    assert.equal(room.sentCommands.at(-1)?.action, "world-replace");
    assert.deepEqual(
      map.voxels.blocksets.definitions().map(({ id }) => id),
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
