// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  VoxelCommandArbiter
} from "../../src/network/VoxelCommandArbiter.ts";
import type { VoxelNetworkCommand } from "../../src/network/types.ts";
import {
  blockDefinedCmd,
  makeAddedCommand,
  voxelSetCmd
} from "../helpers/networkCommands.ts";

describe("VoxelCommandArbiter", () => {
  test("keys a voxel command by layer and position", () => {
    assert.strictEqual(
      VoxelCommandArbiter.key(voxelSetCmd({
        x: 1,
        y: 2,
        z: 3
      })),
      "Ground:1,2,3"
    );
  });

  test("structural commands have no key and are always accepted", () => {
    const arbiter = new VoxelCommandArbiter();
    const added: VoxelNetworkCommand = {
      ...makeAddedCommand("Ground"),
      clientId: "client-A",
      seq: 1,
      timestamp: 1000
    };

    assert.strictEqual(VoxelCommandArbiter.key(added), null);
    assert.strictEqual(arbiter.resolve(added), true);
  });

  test("accepts an uncontested command", () => {
    const arbiter = new VoxelCommandArbiter();

    assert.strictEqual(arbiter.resolve(voxelSetCmd()), true);
  });

  test("rejects a command losing to a recorded later write", () => {
    const arbiter = new VoxelCommandArbiter();
    const late = voxelSetCmd({
      clientId: "late",
      timestamp: 2000
    });

    assert.strictEqual(arbiter.resolve(late), true);
    arbiter.record(late);

    assert.strictEqual(
      arbiter.resolve(voxelSetCmd({
        clientId: "early",
        timestamp: 1000
      })),
      false
    );
  });

  test("an unrecorded command never poisons its key", () => {
    const arbiter = new VoxelCommandArbiter();

    // resolved but deliberately not recorded, as a failed apply would leave it
    arbiter.resolve(voxelSetCmd({
      clientId: "late",
      timestamp: 2000
    }));

    assert.strictEqual(
      arbiter.resolve(voxelSetCmd({
        clientId: "early",
        timestamp: 1000
      })),
      true
    );
  });

  test("different positions do not contend", () => {
    const arbiter = new VoxelCommandArbiter();

    arbiter.record(voxelSetCmd({
      timestamp: 2000,
      x: 0
    }));

    assert.strictEqual(
      arbiter.resolve(voxelSetCmd({
        timestamp: 1000,
        x: 1
      })),
      true
    );
  });
});

describe("VoxelCommandArbiter — block commands", () => {
  test("keys a block command by its block id", () => {
    assert.strictEqual(
      VoxelCommandArbiter.key(blockDefinedCmd({ id: 4 })),
      "block:4"
    );
    assert.strictEqual(
      VoxelCommandArbiter.key({
        action: "block-removed",
        blockId: 4,
        clientId: "client-A",
        seq: 1,
        timestamp: 1000
      }),
      "block:4"
    );
  });

  test("rejects an older edit of the same block", () => {
    const arbiter = new VoxelCommandArbiter();

    arbiter.record(blockDefinedCmd({
      id: 4,
      clientId: "late",
      timestamp: 2000
    }));

    assert.strictEqual(
      arbiter.resolve(blockDefinedCmd({
        id: 4,
        clientId: "early",
        timestamp: 1000
      })),
      false
    );
  });

  test("different blocks do not contend", () => {
    const arbiter = new VoxelCommandArbiter();

    arbiter.record(blockDefinedCmd({
      id: 4,
      clientId: "late",
      timestamp: 2000
    }));

    assert.strictEqual(
      arbiter.resolve(blockDefinedCmd({
        id: 5,
        clientId: "early",
        timestamp: 1000
      })),
      true
    );
  });
});
