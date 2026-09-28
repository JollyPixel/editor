// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  TilesetList,
  VoxelWorld,
  type VoxelWorldCommandTarget
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { VoxelCommandArbiter, type VoxelMapNetworkCommand } from "../../src/network/server.ts";
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
  world.addLayer("Ground");

  return {
    world,
    tilesets: new TilesetList()
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
      admitted(arbiter, voxelSetCmd({ layerName: "Missing" })),
      null
    );
  });

  test("admits a layer transform only for a layer the world has", () => {
    const arbiter = new VoxelCommandArbiter();
    const transform: VoxelMapNetworkCommand = {
      ...kHeader,
      action: "layer-transformed",
      layerName: "Ground",
      metadata: { rotation: 1, flipX: false, flipZ: false, flipY: false }
    };

    assert.strictEqual(admitted(arbiter, { ...transform, layerName: "Missing" }), null);
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
    const added: VoxelMapNetworkCommand = {
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
  ): VoxelMapNetworkCommand {
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
  ): VoxelMapNetworkCommand {
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
      templateCommands().map((command) => VoxelCommandArbiter.key({ ...kHeader, ...command })),
      ["template:pair", "template:pair", "template:pair"]
    );
  });
});

describe("VoxelCommandArbiter — tileset commands", () => {
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
