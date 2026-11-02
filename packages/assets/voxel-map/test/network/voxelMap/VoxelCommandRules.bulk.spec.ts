// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { KeyedCommandArbiter } from "@jolly-pixel/network";
import {
  BlocksetList,
  VoxelWorld,
  type VoxelWorldCommandTarget
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  VOXEL_COMMAND_RULES,
  voxelCommandKeys,
  type VoxelMapNetworkCommand
} from "../../../src/network/server.ts";
import { voxelSetCmd } from "../../helpers/networkCommands.ts";

function createState(): VoxelWorldCommandTarget {
  const world = new VoxelWorld(16);
  world.restoreLayer({ id: "Ground", name: "Ground" });

  return {
    world,
    blocksets: new BlocksetList()
  };
}

function admitted(
  arbiter: KeyedCommandArbiter<VoxelMapNetworkCommand, VoxelWorldCommandTarget>,
  command: VoxelMapNetworkCommand,
  state = createState()
): VoxelMapNetworkCommand | null {
  return arbiter.admit(state, command)?.command ?? null;
}

function commit(
  arbiter: KeyedCommandArbiter<VoxelMapNetworkCommand, VoxelWorldCommandTarget>,
  command: VoxelMapNetworkCommand,
  state = createState()
): void {
  arbiter.admit(state, command)!.commit();
}

describe("VoxelCommandRules — bulk commands", () => {
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
    const arbiter = new KeyedCommandArbiter(VOXEL_COMMAND_RULES);

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
    const arbiter = new KeyedCommandArbiter(VOXEL_COMMAND_RULES);

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
    const arbiter = new KeyedCommandArbiter(VOXEL_COMMAND_RULES);

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
    const arbiter = new KeyedCommandArbiter(VOXEL_COMMAND_RULES);
    const command = voxelsSetCmd([0, 1, 2]);

    assert.strictEqual(admitted(arbiter, command), command);
  });
});

describe("VoxelCommandRules — patch commands", () => {
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
    const arbiter = new KeyedCommandArbiter(VOXEL_COMMAND_RULES);
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
    const arbiter = new KeyedCommandArbiter(VOXEL_COMMAND_RULES);
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
    const arbiter = new KeyedCommandArbiter(VOXEL_COMMAND_RULES);
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
    const arbiter = new KeyedCommandArbiter(VOXEL_COMMAND_RULES);
    const command = voxelsPatchedCmd([0, 1, 2]);

    assert.strictEqual(admitted(arbiter, command), command);
  });

  test("rejects a patch that is not a whole number of cells", () => {
    const arbiter = new KeyedCommandArbiter(VOXEL_COMMAND_RULES);
    const command = voxelsPatchedCmd([0]);
    if (command.action === "voxels-patched") {
      command.metadata.cells.pop();
    }

    assert.strictEqual(admitted(arbiter, command), null);
  });

  test("rejects a patch whose partner targets no cell of the patch", () => {
    const arbiter = new KeyedCommandArbiter(VOXEL_COMMAND_RULES);
    const command = voxelsPatchedCmd([0]);
    if (command.action === "voxels-patched") {
      command.metadata.partners = [1, 9, 16];
    }

    assert.strictEqual(admitted(arbiter, command), null);
  });
});
