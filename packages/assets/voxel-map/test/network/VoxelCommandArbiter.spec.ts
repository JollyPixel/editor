// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelCommandArbiter, type VoxelNetworkCommand } from "../../src/network/server.ts";
import {
  makeAddedCommand,
  voxelSetCmd
} from "../helpers/networkCommands.ts";

function admitted(
  arbiter: VoxelCommandArbiter,
  command: VoxelNetworkCommand
): VoxelNetworkCommand | null {
  return arbiter.admit(command)?.command ?? null;
}

function commit(
  arbiter: VoxelCommandArbiter,
  command: VoxelNetworkCommand
): void {
  arbiter.admit(command)!.commit();
}

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
    assert.strictEqual(admitted(arbiter, added), added);
  });

  test("accepts an uncontested command", () => {
    const arbiter = new VoxelCommandArbiter();

    const uncontested = voxelSetCmd();

    assert.strictEqual(admitted(arbiter, uncontested), uncontested);
  });

  test("rejects a command losing to a recorded later write", () => {
    const arbiter = new VoxelCommandArbiter();
    const late = voxelSetCmd({
      clientId: "late",
      timestamp: 2000
    });

    assert.strictEqual(admitted(arbiter, late), late);
    commit(arbiter, late);

    assert.strictEqual(
      admitted(arbiter, voxelSetCmd({
        clientId: "early",
        timestamp: 1000
      })),
      null
    );
  });

  test("an unrecorded command never poisons its key", () => {
    const arbiter = new VoxelCommandArbiter();

    // admitted but deliberately not recorded, as a failed apply would leave it
    admitted(arbiter, voxelSetCmd({
      clientId: "late",
      timestamp: 2000
    }));
    const early = voxelSetCmd({
      clientId: "early",
      timestamp: 1000
    });

    assert.strictEqual(admitted(arbiter, early), early);
  });

  test("different positions do not contend", () => {
    const arbiter = new VoxelCommandArbiter();

    commit(arbiter, voxelSetCmd({
      timestamp: 2000,
      x: 0
    }));
    const other = voxelSetCmd({
      timestamp: 1000,
      x: 1
    });

    assert.strictEqual(admitted(arbiter, other), other);
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

    commit(arbiter, voxelsSetCmd([0, 1], { timestamp: 2000 }));

    assert.strictEqual(
      admitted(arbiter, voxelSetCmd({
        clientId: "early",
        timestamp: 1000,
        x: 1
      })),
      null
    );
  });

  test("a single write loses to a cell a bulk command already won", () => {
    const arbiter = new VoxelCommandArbiter();

    commit(arbiter, voxelSetCmd({
      clientId: "late",
      timestamp: 2000,
      x: 1
    }));

    const narrowed = admitted(
      arbiter,
      voxelsSetCmd([0, 1, 2], {
        clientId: "early",
        timestamp: 1000
      })
    );

    assert.notStrictEqual(narrowed, null);
    assert.deepStrictEqual(
      VoxelCommandArbiter.keys(narrowed!),
      ["Ground:0,0,0", "Ground:2,0,0"]
    );
  });

  test("drops a bulk command losing every one of its cells", () => {
    const arbiter = new VoxelCommandArbiter();

    commit(arbiter, voxelsSetCmd([0, 1], {
      clientId: "late",
      timestamp: 2000
    }));

    assert.strictEqual(
      admitted(arbiter, voxelsSetCmd([0, 1], {
        clientId: "early",
        timestamp: 1000
      })),
      null
    );
  });

  test("passes an uncontested bulk command through untouched", () => {
    const arbiter = new VoxelCommandArbiter();
    const command = voxelsSetCmd([0, 1, 2]);

    assert.strictEqual(admitted(arbiter, command), command);
  });
});

describe("VoxelCommandArbiter — patch commands", () => {
  function voxelsPatchedCmd(
    xs: number[],
    opts: { clientId?: string; timestamp?: number; } = {}
  ): VoxelNetworkCommand {
    return {
      action: "voxels-patched",
      layerName: "Ground",
      metadata: {
        cells: xs.flatMap((x) => [x, 0, 0, x + 1, 0])
      },
      clientId: opts.clientId ?? "client-A",
      seq: 1,
      timestamp: opts.timestamp ?? 1000
    };
  }

  test("keys a patch by every cell it touches", () => {
    assert.deepStrictEqual(
      VoxelCommandArbiter.keys(voxelsPatchedCmd([0, 1])),
      ["Ground:0,0,0", "Ground:1,0,0"]
    );
  });

  test("narrows a patch to the cells that win", () => {
    const arbiter = new VoxelCommandArbiter();
    commit(arbiter, voxelSetCmd({
      clientId: "late",
      timestamp: 2000,
      x: 1
    }));

    const narrowed = admitted(arbiter, voxelsPatchedCmd([0, 1, 2], {
      clientId: "early",
      timestamp: 1000
    }));

    assert.deepStrictEqual(
      narrowed?.action === "voxels-patched" && narrowed.metadata.cells,
      [0, 0, 0, 1, 0, 2, 0, 0, 3, 0]
    );
  });

  test("records every cell of a patch", () => {
    const arbiter = new VoxelCommandArbiter();
    commit(arbiter, voxelsPatchedCmd([0, 1], { timestamp: 2000 }));

    assert.strictEqual(
      admitted(arbiter, voxelSetCmd({
        clientId: "early",
        timestamp: 1000,
        x: 1
      })),
      null
    );
  });

  test("passes an uncontested patch through untouched", () => {
    const arbiter = new VoxelCommandArbiter();
    const command = voxelsPatchedCmd([0, 1, 2]);

    assert.strictEqual(admitted(arbiter, command), command);
  });

  test("rejects a patch that is not a whole number of cells", () => {
    const arbiter = new VoxelCommandArbiter();
    const command = voxelsPatchedCmd([0]);
    if (command.action === "voxels-patched") {
      command.metadata.cells.pop();
    }

    assert.strictEqual(admitted(arbiter, command), null);
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

    assert.strictEqual(admitted(arbiter, moveToProps), moveToProps);
    commit(arbiter, moveToProps);

    assert.strictEqual(admitted(arbiter, moveToDeco), null);
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

    commit(arbiter, first);

    assert.strictEqual(admitted(arbiter, second), second);
  });
});

describe("VoxelCommandArbiter — tileset commands", () => {
  const kHeader = {
    clientId: "client-A",
    seq: 1,
    timestamp: 1000
  };

  test("keys a tileset command by its tileset id", () => {
    assert.strictEqual(VoxelCommandArbiter.key({
      ...kHeader,
      action: "tileset-added",
      tileset: { id: "stone", src: "asset-stone", tileSize: 16 }
    }), "tileset:stone");
    assert.strictEqual(VoxelCommandArbiter.key({
      ...kHeader,
      action: "tileset-removed",
      tilesetId: "stone"
    }), "tileset:stone");
  });
});
