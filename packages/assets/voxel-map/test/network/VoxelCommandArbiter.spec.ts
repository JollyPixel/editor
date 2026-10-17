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
  type VoxelMapNetworkCommand
} from "../../src/network/server.ts";
import {
  templateCommands,
  voxelSetCmd,
  worldReplaceCmd,
  makeAddedCommand
} from "../helpers/networkCommands.ts";

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

const kHeader = {
  clientId: "client-A",
  seq: 1,
  timestamp: 1000
};

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
