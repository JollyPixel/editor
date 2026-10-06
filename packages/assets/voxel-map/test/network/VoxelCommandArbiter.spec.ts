// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  BlocksetList,
  VoxelWorld,
  type VoxelWorldCommandTarget
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  VoxelCommandArbiter,
  voxelCommandKey,
  voxelCommandKeys,
  type VoxelMapNetworkCommand
} from "../../src/network/server.ts";
import {
  makeAddedCommand,
  templateCommands,
  voxelSetCmd,
  worldReplaceCmd
} from "../helpers/networkCommands.ts";

// CONSTANTS
const kHeader = {
  clientId: "client-A",
  seq: 1,
  timestamp: 1000
};

function createState(): VoxelWorldCommandTarget {
  const world = new VoxelWorld(16);
  world.restoreLayer({ id: "Ground", name: "Ground" });

  return {
    world,
    blocksets: new BlocksetList()
  };
}

function admitted(
  arbiter: VoxelCommandArbiter,
  command: VoxelMapNetworkCommand,
  state = createState()
): VoxelMapNetworkCommand | null {
  return arbiter.admit(state, command)?.command ?? null;
}

function commit(
  arbiter: VoxelCommandArbiter,
  command: VoxelMapNetworkCommand,
  state = createState()
): void {
  arbiter.admit(state, command)!.commit();
}

describe("VoxelCommandArbiter — state checks", () => {
  test("rejects a voxel write to a layer the world does not have", () => {
    const arbiter = new VoxelCommandArbiter();

    assert.strictEqual(
      admitted(arbiter, voxelSetCmd({ layerId: "Missing" })),
      null
    );
  });

  test("admits a layer transform only for a layer the world has", () => {
    const arbiter = new VoxelCommandArbiter();
    const transform: VoxelMapNetworkCommand = {
      ...kHeader,
      action: "layer-transformed",
      layerId: "Ground",
      metadata: { rotation: 1, flipX: false, flipZ: false, flipY: false }
    };

    assert.strictEqual(admitted(arbiter, { ...transform, layerId: "Missing" }), null);
    assert.strictEqual(admitted(arbiter, transform), transform);
  });

  test("rejects a world-replace whose layers cannot be loaded", () => {
    const arbiter = new VoxelCommandArbiter();
    const replace = worldReplaceCmd();
    assert.strictEqual(replace.action, "world-replace");
    const broken: VoxelMapNetworkCommand = {
      ...replace,
      data: {
        ...replace.data,
        layers: JSON.parse("[{}]")
      }
    };

    assert.strictEqual(admitted(arbiter, broken), null);
    assert.strictEqual(admitted(arbiter, replace), replace);
  });

  test("rejects a template whose voxels cannot be decoded", () => {
    const arbiter = new VoxelCommandArbiter();
    const [defined] = templateCommands();
    assert.ok(defined.action === "template-defined");
    const command: VoxelMapNetworkCommand = { ...kHeader, ...defined };
    const broken: VoxelMapNetworkCommand = {
      ...command,
      template: {
        ...defined.template,
        palette: []
      }
    };

    assert.strictEqual(admitted(arbiter, broken), null);
    assert.strictEqual(admitted(arbiter, command), command);
  });

  test("a committed world-replace supersedes every recorded voxel", () => {
    const arbiter = new VoxelCommandArbiter();
    commit(arbiter, voxelSetCmd({ timestamp: 100 }));
    commit(arbiter, worldReplaceCmd({ clientId: "client-B", timestamp: 500 }));

    assert.strictEqual(
      admitted(arbiter, voxelSetCmd({ x: 9, y: 9, z: 9, clientId: "client-C", timestamp: 400 })),
      null
    );
    assert.notStrictEqual(
      admitted(arbiter, voxelSetCmd({ clientId: "client-C", timestamp: 600 })),
      null
    );
  });
});

describe("VoxelCommandArbiter", () => {
  test("keys a voxel command by layer and position", () => {
    assert.strictEqual(
      voxelCommandKey(voxelSetCmd({
        x: 1,
        y: 2,
        z: 3
      })),
      "Ground:1,2,3"
    );
  });

  test("admits a new layer without a key, and refuses an id the world has", () => {
    const arbiter = new VoxelCommandArbiter();
    const header = {
      clientId: "client-A",
      seq: 1,
      timestamp: 1000
    };
    const added: VoxelMapNetworkCommand = { ...makeAddedCommand("Other"), ...header };

    assert.strictEqual(voxelCommandKey(added), null);
    assert.strictEqual(admitted(arbiter, added), added);
    assert.strictEqual(admitted(arbiter, { ...makeAddedCommand("Ground"), ...header }), null);
  });

  test("keys a layer move by layer, and refuses one for a layer the world lacks", () => {
    const arbiter = new VoxelCommandArbiter();
    const moved: VoxelMapNetworkCommand = {
      ...kHeader,
      action: "layer-moved",
      layerId: "Ground",
      metadata: { rank: "k" }
    };

    assert.strictEqual(voxelCommandKey(moved), "layer-order:Ground");
    assert.strictEqual(admitted(arbiter, moved), moved);
    assert.strictEqual(admitted(arbiter, { ...moved, layerId: "Missing" }), null);
  });

  test("refuses a clone onto an existing id or a merge into itself", () => {
    const arbiter = new VoxelCommandArbiter();

    assert.strictEqual(admitted(arbiter, {
      ...kHeader,
      action: "cloned",
      layerId: "Ground",
      metadata: { cloneId: "Ground", rank: "k", options: { name: "Copy" } }
    }), null);
    assert.strictEqual(admitted(arbiter, {
      ...kHeader,
      action: "merged",
      layerId: "Ground",
      metadata: { targetLayerId: "Ground" }
    }), null);
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
  ): VoxelMapNetworkCommand {
    return {
      action: "voxels-set",
      layerId: "Ground",
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
      voxelCommandKeys(voxelsSetCmd([0, 1])),
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
      voxelCommandKeys(narrowed!),
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
  ): VoxelMapNetworkCommand {
    return {
      action: "voxels-patched",
      layerId: "Ground",
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
      voxelCommandKeys(voxelsPatchedCmd([0, 1])),
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

  test("renumbers the partners of the cells a narrowed patch keeps", () => {
    const arbiter = new VoxelCommandArbiter();
    commit(arbiter, voxelSetCmd({
      clientId: "late",
      timestamp: 2000,
      x: 0
    }));
    const command = voxelsPatchedCmd([0, 1], {
      clientId: "early",
      timestamp: 1000
    });
    if (command.action === "voxels-patched") {
      command.metadata.partners = [0, 9, 16, 1, 9, 17];
    }

    const narrowed = admitted(arbiter, command);

    assert.deepStrictEqual(
      narrowed?.action === "voxels-patched" && narrowed.metadata,
      {
        cells: [1, 0, 0, 2, 0],
        partners: [0, 9, 17]
      }
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

  test("rejects a patch whose partner targets no cell of the patch", () => {
    const arbiter = new VoxelCommandArbiter();
    const command = voxelsPatchedCmd([0]);
    if (command.action === "voxels-patched") {
      command.metadata.partners = [1, 9, 16];
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
      voxelCommandKey({
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
      voxelCommandKey({
        ...header,
        action: "object-removed",
        layerName: "Spawns",
        metadata: { objectId: "obj1" }
      }),
      "object:obj1"
    );

    assert.strictEqual(
      voxelCommandKey({
        ...header,
        action: "object-updated",
        layerName: "Spawns",
        metadata: { objectId: "obj1", patch: { name: "Renamed" } }
      }),
      "object:obj1"
    );

    assert.strictEqual(
      voxelCommandKey({
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
    const moveToProps: VoxelMapNetworkCommand = {
      ...header,
      action: "object-moved",
      layerName: "Spawns",
      metadata: {
        objectId: "obj1",
        fromLayerName: "Spawns",
        toLayerName: "Props"
      }
    };
    const moveToDeco: VoxelMapNetworkCommand = {
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
    const first: VoxelMapNetworkCommand = {
      ...header,
      action: "object-moved",
      layerName: "Spawns",
      metadata: {
        objectId: "obj1",
        fromLayerName: "Spawns",
        toLayerName: "Props"
      }
    };
    const second: VoxelMapNetworkCommand = {
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

describe("VoxelCommandArbiter — template commands", () => {
  test("keys every template command by its template id", () => {
    assert.deepEqual(
      templateCommands().map((command) => voxelCommandKey({ ...kHeader, ...command })),
      ["template:pair", "template:pair", "template:pair"]
    );
  });
});

describe("VoxelCommandArbiter — blockset commands", () => {
  test("keys a blockset command by its blockset id", () => {
    assert.strictEqual(voxelCommandKey({
      ...kHeader,
      action: "blockset-added",
      blockset: { id: "stone", src: "asset-stone", tileSize: 16 }
    }), "blockset:stone");
    assert.strictEqual(voxelCommandKey({
      ...kHeader,
      action: "blockset-removed",
      blocksetId: "stone"
    }), "blockset:stone");
  });
});

describe("VoxelCommandArbiter.restore", () => {
  test("records a past write, so an older replay of that cell loses", () => {
    const arbiter = new VoxelCommandArbiter();
    arbiter.restore(voxelSetCmd({ clientId: "client-B" }), 6);

    assert.strictEqual(
      arbiter.admit(createState(), { ...voxelSetCmd({ clientId: "client-A" }), basis: 5 }),
      null
    );
    assert.notStrictEqual(
      arbiter.admit(createState(), voxelSetCmd({ clientId: "client-A", timestamp: 1 })),
      null
    );
  });

  test("a restored world replacement floors every cell", () => {
    const arbiter = new VoxelCommandArbiter();
    arbiter.restore(worldReplaceCmd({ clientId: "client-B" }), 4);

    assert.strictEqual(
      arbiter.admit(createState(), { ...voxelSetCmd({ clientId: "client-A", x: 3 }), basis: 2 }),
      null
    );
  });
});
