// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelCommandArbiter, type VoxelNetworkCommand } from "../../src/network/index.ts";
import {
  blockDefinedCmd,
  blockMovedCmd,
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
    assert.strictEqual(arbiter.admit(added), added);
  });

  test("accepts an uncontested command", () => {
    const arbiter = new VoxelCommandArbiter();

    const uncontested = voxelSetCmd();

    assert.strictEqual(arbiter.admit(uncontested), uncontested);
  });

  test("rejects a command losing to a recorded later write", () => {
    const arbiter = new VoxelCommandArbiter();
    const late = voxelSetCmd({
      clientId: "late",
      timestamp: 2000
    });

    assert.strictEqual(arbiter.admit(late), late);
    arbiter.record(late);

    assert.strictEqual(
      arbiter.admit(voxelSetCmd({
        clientId: "early",
        timestamp: 1000
      })),
      null
    );
  });

  test("an unrecorded command never poisons its key", () => {
    const arbiter = new VoxelCommandArbiter();

    // admitted but deliberately not recorded, as a failed apply would leave it
    arbiter.admit(voxelSetCmd({
      clientId: "late",
      timestamp: 2000
    }));
    const early = voxelSetCmd({
      clientId: "early",
      timestamp: 1000
    });

    assert.strictEqual(arbiter.admit(early), early);
  });

  test("different positions do not contend", () => {
    const arbiter = new VoxelCommandArbiter();

    arbiter.record(voxelSetCmd({
      timestamp: 2000,
      x: 0
    }));
    const other = voxelSetCmd({
      timestamp: 1000,
      x: 1
    });

    assert.strictEqual(arbiter.admit(other), other);
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
      arbiter.admit(blockDefinedCmd({
        id: 4,
        clientId: "early",
        timestamp: 1000
      })),
      null
    );
  });

  test("different blocks do not contend", () => {
    const arbiter = new VoxelCommandArbiter();

    arbiter.record(blockDefinedCmd({
      id: 4,
      clientId: "late",
      timestamp: 2000
    }));

    const other = blockDefinedCmd({
      id: 5,
      clientId: "early",
      timestamp: 1000
    });

    assert.strictEqual(arbiter.admit(other), other);
  });
});

describe("VoxelCommandArbiter — bulk commands", () => {
  function voxelsSetCmd(
    xs: number[],
    opts: { clientId?: string; timestamp?: number; } = {}
  ): VoxelNetworkCommand {
    return {
      action: "voxels-set",
      layerName: "Ground",
      metadata: {
        entries: xs.map((x) => {
          return {
            position: { x, y: 0, z: 0 },
            blockId: 1
          };
        })
      },
      clientId: opts.clientId ?? "client-A",
      seq: 1,
      timestamp: opts.timestamp ?? 1000
    };
  }

  test("keys a bulk command by every cell it touches", () => {
    assert.deepStrictEqual(
      VoxelCommandArbiter.keys(voxelsSetCmd([0, 1])),
      ["Ground:0,0,0", "Ground:1,0,0"]
    );
  });

  test("records every cell of a bulk command", () => {
    const arbiter = new VoxelCommandArbiter();

    arbiter.record(voxelsSetCmd([0, 1], { timestamp: 2000 }));

    assert.strictEqual(
      arbiter.admit(voxelSetCmd({
        clientId: "early",
        timestamp: 1000,
        x: 1
      })),
      null
    );
  });

  test("a single write loses to a cell a bulk command already won", () => {
    const arbiter = new VoxelCommandArbiter();

    arbiter.record(voxelSetCmd({
      clientId: "late",
      timestamp: 2000,
      x: 1
    }));

    const admitted = arbiter.admit(
      voxelsSetCmd([0, 1, 2], {
        clientId: "early",
        timestamp: 1000
      })
    );

    assert.notStrictEqual(admitted, null);
    assert.deepStrictEqual(
      VoxelCommandArbiter.keys(admitted!),
      ["Ground:0,0,0", "Ground:2,0,0"]
    );
  });

  test("drops a bulk command losing every one of its cells", () => {
    const arbiter = new VoxelCommandArbiter();

    arbiter.record(voxelsSetCmd([0, 1], {
      clientId: "late",
      timestamp: 2000
    }));

    assert.strictEqual(
      arbiter.admit(voxelsSetCmd([0, 1], {
        clientId: "early",
        timestamp: 1000
      })),
      null
    );
  });

  test("passes an uncontested bulk command through untouched", () => {
    const arbiter = new VoxelCommandArbiter();
    const command = voxelsSetCmd([0, 1, 2]);

    assert.strictEqual(arbiter.admit(command), command);
  });
});

describe("VoxelCommandArbiter — object commands", () => {
  const header = {
    clientId: "client-A",
    seq: 1,
    timestamp: 1000
  };

  test("keys every object command by the object id alone", () => {
    assert.strictEqual(
      VoxelCommandArbiter.key({
        ...header,
        action: "object-added",
        layerName: "Spawns",
        metadata: {
          object: {
            id: "obj1",
            name: "Spawn",
            x: 0,
            y: 0,
            z: 0,
            visible: true
          }
        }
      }),
      "object:obj1"
    );

    assert.strictEqual(
      VoxelCommandArbiter.key({
        ...header,
        action: "object-removed",
        layerName: "Spawns",
        metadata: { objectId: "obj1" }
      }),
      "object:obj1"
    );

    assert.strictEqual(
      VoxelCommandArbiter.key({
        ...header,
        action: "object-updated",
        layerName: "Spawns",
        metadata: { objectId: "obj1", patch: { name: "Renamed" } }
      }),
      "object:obj1"
    );

    assert.strictEqual(
      VoxelCommandArbiter.key({
        ...header,
        action: "object-moved",
        layerName: "Spawns",
        metadata: {
          objectId: "obj1",
          fromLayerName: "Spawns",
          toLayerName: "Props"
        }
      }),
      "object:obj1"
    );
  });

  test("resolves two concurrent moves of one object to a single winner", () => {
    const arbiter = new VoxelCommandArbiter();
    const moveToProps: VoxelNetworkCommand = {
      ...header,
      action: "object-moved",
      layerName: "Spawns",
      metadata: {
        objectId: "obj1",
        fromLayerName: "Spawns",
        toLayerName: "Props"
      }
    };
    const moveToDeco: VoxelNetworkCommand = {
      ...moveToProps,
      clientId: "client-B",
      timestamp: 900,
      metadata: {
        objectId: "obj1",
        fromLayerName: "Spawns",
        toLayerName: "Deco"
      }
    };

    assert.strictEqual(arbiter.admit(moveToProps), moveToProps);
    arbiter.record(moveToProps);

    assert.strictEqual(arbiter.admit(moveToDeco), null);
  });

  test("leaves a different object unaffected", () => {
    const arbiter = new VoxelCommandArbiter();
    const first: VoxelNetworkCommand = {
      ...header,
      action: "object-moved",
      layerName: "Spawns",
      metadata: {
        objectId: "obj1",
        fromLayerName: "Spawns",
        toLayerName: "Props"
      }
    };
    const second: VoxelNetworkCommand = {
      ...first,
      clientId: "client-B",
      timestamp: 900,
      metadata: {
        objectId: "obj2",
        fromLayerName: "Spawns",
        toLayerName: "Props"
      }
    };

    arbiter.record(first);

    assert.strictEqual(arbiter.admit(second), second);
  });
});

describe("VoxelCommandArbiter — block reorder", () => {
  test("keys a block move by its block id", () => {
    assert.strictEqual(
      VoxelCommandArbiter.key(blockMovedCmd({ blockId: 4, toIndex: 2 })),
      "block:4"
    );
  });

  test("rejects a move older than the last edit of the same block", () => {
    const arbiter = new VoxelCommandArbiter();

    arbiter.record(blockDefinedCmd({
      id: 4,
      clientId: "late",
      timestamp: 2000
    }));

    assert.strictEqual(
      arbiter.admit(blockMovedCmd({
        blockId: 4,
        toIndex: 0,
        clientId: "early",
        timestamp: 1000
      })),
      null
    );
  });

  test("admits moves of different blocks", () => {
    const arbiter = new VoxelCommandArbiter();
    const first = blockMovedCmd({ blockId: 1, toIndex: 2, timestamp: 2000 });
    const second = blockMovedCmd({ blockId: 2, toIndex: 0, timestamp: 1000 });

    arbiter.record(first);

    assert.strictEqual(arbiter.admit(second), second);
  });
});
