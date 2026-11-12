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
} from "#src/network/voxelMap/SyncedVoxelMap.ts";
import { VOXEL_MAP_KIND } from "#src/asset/voxelMap.ts";
import { createMockRoom } from "../../helpers/room.ts";
import { mapHistory } from "../../helpers/history.ts";

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
    map.edits.receipts.subscribe("confirmed", (change) => confirmed.push(change.command.action));

    map.voxels.world.placeVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: 1 });
    room.simulateCommand(room.sentCommands.at(-1)!);

    assert.deepEqual(confirmed, ["added", "voxel-set"]);
    map.dispose();
  });

  it("applies a world command as a step answered by the room's echo", () => {
    const room = createMockRoom();
    const map = new SyncedVoxelMap(room);
    room.simulateSnapshot(kSnapshot);
    map.voxels.world.addLayer("Ground");
    room.simulateCommand(room.sentCommands[0]);
    const layerId = map.voxels.world.findLayer("Ground")!.id;
    const confirmed: string[] = [];
    map.receipts.subscribe("confirmed", (change) => confirmed.push(change.command.action));

    const step = map.applyStep({
      action: "voxel-set",
      layerId,
      metadata: {
        position: { x: 1, y: 2, z: 3 },
        blockId: 1,
        rotation: 0,
        flipX: false,
        flipY: false,
        flipZ: false
      }
    });
    room.simulateCommand(room.sentCommands.at(-1)!);

    assert.equal(step?.command.action, "voxel-set");
    assert.equal(map.voxels.world.voxelAt({ x: 1, y: 2, z: 3 })?.blockId, 1);
    assert.deepEqual(confirmed, ["voxel-set"]);
    map.dispose();
  });

  it("applies no step for a layer the map does not have", () => {
    const room = createMockRoom();
    const map = new SyncedVoxelMap(room);
    room.simulateSnapshot(kSnapshot);

    const step = map.applyStep({
      action: "voxel-removed",
      layerId: "nowhere",
      metadata: { position: { x: 0, y: 0, z: 0 } }
    });

    assert.equal(step, null);
    assert.equal(room.sentCommands.length, 0);
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

    const lease = kind.syncDocument(room);

    assert.ok(lease.document instanceof SyncedVoxelMap);
    assert.equal(lease.document.voxels.chunkSize, 8);
    lease.dispose();
  });
});
