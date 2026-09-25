// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelWorld } from "../../src/world/index.ts";
import { VOXEL_LAYER_COMMAND_ACTIONS, type VoxelLayerCommand } from "../../src/commands/index.ts";
import { makeVoxelEntry } from "../helpers/voxelEntry.ts";
import { makeObject, recordCommands } from "../helpers/fakes.ts";
import { withoutId } from "../helpers/world.ts";

interface RoundTripCase {
  name: string;
  seed?: (world: VoxelWorld) => void;
  act: (world: VoxelWorld) => void;
  actions: VoxelLayerCommand["action"][];
  check?: (remote: VoxelWorld) => void;
}

interface Peers {
  local: VoxelWorld;
  remote: VoxelWorld;
  commands: VoxelLayerCommand[];
}

function makePeers(
  seed: (world: VoxelWorld) => void = () => void 0
): Peers {
  const local = new VoxelWorld(4);
  const remote = new VoxelWorld(4);
  seed(local);
  seed(remote);

  return { local, remote, commands: recordCommands(local) };
}

function stateOf(
  world: VoxelWorld
): unknown {
  return {
    layers: world.getLayers().map(withoutId),
    objectLayers: world.objectLayers.toArray().map(({ id, ...rest }) => structuredClone(rest))
  };
}

function ground(
  world: VoxelWorld
): void {
  world.addLayer("Ground");
  world.setVoxelAt("Ground", { x: 0, y: 0, z: 0 }, makeVoxelEntry(1));
  world.setVoxelAt("Ground", { x: 1, y: 0, z: 0 }, makeVoxelEntry(2));
}

function stack(
  world: VoxelWorld
): void {
  for (const name of ["A", "B", "C"]) {
    world.addLayer(name);
  }
}

function spawns(
  world: VoxelWorld
): void {
  world.objectLayers.add("From");
  world.objectLayers.add("To");
  world.objectLayers.addObject("From", makeObject({ id: "obj1" }));
  world.objectLayers.addObject("From", makeObject({ id: "obj2" }));
}

const kCases: RoundTripCase[] = [
  {
    name: "adds a layer with its options",
    act: (world) => world.addLayer("Deco", { visible: false, opacity: 0.5 }),
    actions: ["added"]
  },
  {
    name: "removes a layer",
    seed: ground,
    act: (world) => world.removeLayer("Ground"),
    actions: ["removed"]
  },
  {
    name: "updates a layer",
    seed: ground,
    act: (world) => world.updateLayer("Ground", { visible: false }),
    actions: ["updated"]
  },
  {
    name: "sets then translates a layer position",
    seed: ground,
    act: (world) => {
      world.setLayerPosition("Ground", { x: 2, y: 0, z: 0 });
      world.translateLayer("Ground", { x: 3, y: 1, z: 0 });
    },
    actions: ["position-updated", "position-updated"],
    check: (remote) => assert.deepEqual(remote.getLayer("Ground")?.position, { x: 5, y: 1, z: 0 })
  },
  {
    name: "rebases a layer without moving its voxels",
    seed: ground,
    act: (world) => world.rebaseLayer("Ground", { x: 1, y: 0, z: 0 }),
    actions: ["position-rebased"],
    check: (remote) => assert.equal(remote.getVoxelAt({ x: 1, y: 0, z: 0 })?.blockId, 2)
  },
  {
    name: "swaps a layer with its neighbour",
    seed: stack,
    act: (world) => world.moveLayer("A", "up"),
    actions: ["reordered"]
  },
  {
    name: "moves a layer across the stack",
    seed: stack,
    act: (world) => world.moveLayerTo("C", 2),
    actions: ["layer-moved"]
  },
  {
    name: "sets a transformed voxel",
    seed: ground,
    act: (world) => world.setVoxel("Ground", {
      position: { x: 2, y: 0, z: 0 },
      blockId: 3,
      rotation: 1,
      flipX: true
    }),
    actions: ["voxel-set"]
  },
  {
    name: "removes a voxel",
    seed: ground,
    act: (world) => world.removeVoxel("Ground", { position: { x: 0, y: 0, z: 0 } }),
    actions: ["voxel-removed"]
  },
  {
    name: "sets voxels in bulk",
    seed: ground,
    act: (world) => world.setVoxelBulk("Ground", [
      { position: { x: 2, y: 0, z: 0 }, blockId: 3, rotation: 2 },
      { position: { x: 9, y: 0, z: 0 }, blockId: 4 }
    ]),
    actions: ["voxels-set"]
  },
  {
    name: "removes voxels in bulk",
    seed: ground,
    act: (world) => world.removeVoxelBulk("Ground", [
      { position: { x: 0, y: 0, z: 0 } },
      { position: { x: 1, y: 0, z: 0 } }
    ]),
    actions: ["voxels-removed"]
  },
  {
    name: "patches voxels",
    seed: ground,
    act: (world) => world.patchVoxels("Ground", [
      0, 0, 0, 0, 0,
      2, 0, 0, 3, 5,
      9, 0, 0, 4, 0
    ]),
    actions: ["voxels-patched"]
  },
  {
    name: "coalesces a transaction into one patch per layer",
    seed: (world) => {
      world.addLayer("Top");
      ground(world);
    },
    act: (world) => world.transaction(() => {
      world.setVoxel("Ground", { position: { x: 2, y: 0, z: 0 }, blockId: 3, rotation: 1 });
      world.removeVoxel("Ground", { position: { x: 0, y: 0, z: 0 } });
      world.setVoxel("Top", { position: { x: 0, y: 1, z: 0 }, blockId: 6 });
      world.setVoxel("Ground", { position: { x: 2, y: 0, z: 0 }, blockId: 4 });
    }),
    actions: ["voxels-patched", "voxels-patched"]
  },
  {
    name: "clones a layer, voxels included, under a derived name",
    seed: (world) => {
      world.addLayer("Bottom");
      ground(world);
    },
    act: (world) => {
      world.cloneLayer("Ground");
      world.cloneLayer("Ground");
    },
    actions: ["cloned", "cloned"],
    check: (remote) => assert.deepEqual(
      remote.getLayers().map((layer) => layer.name),
      ["Ground (1)", "Ground (2)", "Ground", "Bottom"]
    )
  },
  {
    name: "merges a layer and resolves overlaps identically",
    seed: (world) => {
      world.addLayer("Target", { properties: { biome: "forest" } });
      world.addLayer("Source", { properties: { seed: 7 } });
      world.setVoxelAt("Target", { x: 0, y: 0, z: 0 }, makeVoxelEntry(1));
      world.setVoxelAt("Source", { x: 0, y: 0, z: 0 }, makeVoxelEntry(9));
      world.setVoxelAt("Source", { x: 5, y: 0, z: 0 }, makeVoxelEntry(3));
    },
    act: (world) => world.mergeLayer("Source", "Target"),
    actions: ["merged"],
    check: (remote) => assert.equal(remote.getVoxelAt({ x: 0, y: 0, z: 0 })?.blockId, 9)
  },
  {
    name: "adds an object layer",
    act: (world) => world.objectLayers.add("Spawns"),
    actions: ["object-layer-added"]
  },
  {
    name: "removes an object layer",
    seed: spawns,
    act: (world) => world.objectLayers.remove("To"),
    actions: ["object-layer-removed"]
  },
  {
    name: "updates an object layer",
    seed: spawns,
    act: (world) => world.objectLayers.update("From", { visible: false }),
    actions: ["object-layer-updated"]
  },
  {
    name: "adds an object",
    seed: spawns,
    act: (world) => world.objectLayers.addObject("To", makeObject({ id: "obj3", x: 5 })),
    actions: ["object-added"]
  },
  {
    name: "removes an object",
    seed: spawns,
    act: (world) => world.objectLayers.removeObject("From", "obj1"),
    actions: ["object-removed"]
  },
  {
    name: "updates an object",
    seed: spawns,
    act: (world) => world.objectLayers.updateObject("From", "obj1", { x: 10, visible: false }),
    actions: ["object-updated"]
  },
  {
    name: "moves an object between object layers",
    seed: spawns,
    act: (world) => world.objectLayers.moveObject("From", "obj1", "To"),
    actions: ["object-moved"],
    check: (remote) => assert.deepEqual(
      remote.objectLayers.get("To")?.objects.map((object) => object.id),
      ["obj1"]
    )
  }
];

describe("command round-trip", () => {
  for (const { name, seed, act, actions, check } of kCases) {
    it(name, () => {
      const { local, remote, commands } = makePeers(seed);
      const before = stateOf(remote);

      act(local);
      for (const command of commands) {
        remote.apply(command);
      }

      assert.deepEqual(commands.map(({ action }) => action), actions);
      assert.notDeepEqual(stateOf(remote), before);
      assert.deepEqual(stateOf(remote), stateOf(local));
      check?.(remote);
    });
  }

  it("covers every layer command action", () => {
    const covered = new Set(kCases.flatMap(({ actions }) => actions));

    assert.deepEqual(
      VOXEL_LAYER_COMMAND_ACTIONS.filter((action) => !covered.has(action)),
      []
    );
  });

  it("drops a late voxel command aimed at a merged-away layer", () => {
    const { local, remote, commands } = makePeers((world) => {
      world.addLayer("Target");
      world.addLayer("Source");
    });

    local.mergeLayer("Source", "Target");
    for (const command of commands) {
      remote.apply(command);
    }
    remote.apply({
      action: "voxels-set",
      layerName: "Source",
      metadata: { entries: [{ position: { x: 0, y: 0, z: 0 }, blockId: 4 }] }
    });

    assert.deepEqual(stateOf(remote), stateOf(local));
  });
});
