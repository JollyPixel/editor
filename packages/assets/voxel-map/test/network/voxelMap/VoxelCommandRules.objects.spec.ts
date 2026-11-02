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
  voxelCommandKey,
  type VoxelMapNetworkCommand
} from "../../../src/network/server.ts";
import {
  templateCommands,
  voxelSetCmd,
  worldReplaceCmd
} from "../../helpers/networkCommands.ts";

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

const kHeader = {
  clientId: "client-A",
  seq: 1,
  timestamp: 1000
};

describe("VoxelCommandRules — object commands", () => {
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
    const arbiter = new KeyedCommandArbiter(VOXEL_COMMAND_RULES);
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
    const arbiter = new KeyedCommandArbiter(VOXEL_COMMAND_RULES);
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

describe("VoxelCommandRules — template commands", () => {
  test("keys every template command by its template id", () => {
    assert.deepEqual(
      templateCommands().map((command) => voxelCommandKey({ ...kHeader, ...command })),
      ["template:pair", "template:pair", "template:pair"]
    );
  });
});

describe("VoxelCommandRules — blockset commands", () => {
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

describe("VoxelCommandRules — restore", () => {
  test("records a past write, so an older replay of that cell loses", () => {
    const arbiter = new KeyedCommandArbiter(VOXEL_COMMAND_RULES);
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
    const arbiter = new KeyedCommandArbiter(VOXEL_COMMAND_RULES);
    arbiter.restore(worldReplaceCmd({ clientId: "client-B" }), 4);

    assert.strictEqual(
      arbiter.admit(createState(), { ...voxelSetCmd({ clientId: "client-A", x: 3 }), basis: 2 }),
      null
    );
  });
});
