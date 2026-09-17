// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelTransform, VoxelWorld } from "../../src/world/index.ts";
import { VOXEL_LAYER_COMMAND_ACTIONS, type VoxelLayerCommand } from "../../src/commands.ts";
import type { VoxelObjectJSON } from "../../src/serialization/index.ts";
import { makeVoxelEntry } from "../helpers/voxelEntry.ts";
import { makeAddedCommand } from "../helpers/networkCommands.ts";
import type { VoxelLogger } from "../../src/utils/logger.ts";

function makeWorld() {
  return new VoxelWorld(4);
}

function makeSpawnObject(
  overrides: Partial<VoxelObjectJSON> = {}
): VoxelObjectJSON {
  return {
    id: "obj1",
    name: "Spawn",
    x: 0,
    y: 0,
    z: 0,
    visible: true,
    ...overrides
  };
}

describe("VoxelWorld.apply — added", () => {
  it("creates a new layer in the world", () => {
    const world = makeWorld();
    world.apply(makeAddedCommand("Ground"));
    assert.ok(world.getLayer("Ground"));
  });

  it("passes options through to the layer", () => {
    const world = makeWorld();
    world.apply({
      action: "added",
      layerName: "Deco",
      metadata: { options: { visible: false } }
    });
    assert.equal(world.getLayer("Deco")?.visible, false);
  });
});

describe("VoxelWorld.apply — removed", () => {
  it("removes an existing layer", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    world.apply({
      action: "removed",
      layerName: "Ground",
      metadata: {}
    });
    assert.equal(world.getLayer("Ground"), undefined);
  });

  it("is a no-op for an unknown layer", () => {
    const world = makeWorld();
    assert.doesNotThrow(() => {
      world.apply({
        action: "removed",
        layerName: "NoSuch",
        metadata: {}
      });
    });
  });
});

describe("VoxelWorld.apply — updated", () => {
  it("updates layer visibility", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    world.apply({
      action: "updated",
      layerName: "Ground",
      metadata: { options: { visible: false } }
    });
    assert.equal(world.getLayer("Ground")?.visible, false);
  });
});

describe("VoxelWorld.apply — position-updated (absolute)", () => {
  it("sets the layer position", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    world.apply({
      action: "position-updated",
      layerName: "Ground",
      metadata: { position: { x: 5, y: 0, z: 3 } }
    });
    const layer = world.getLayer("Ground");
    assert.ok(layer !== undefined);
    assert.deepEqual(layer.position, { x: 5, y: 0, z: 3 });
  });
});

describe("VoxelWorld.apply — position-updated (delta)", () => {
  it("translates the layer position", () => {
    const world = makeWorld();
    const layer = world.addLayer("Ground");
    layer.position = { x: 2, y: 0, z: 0 };
    world.apply({
      action: "position-updated",
      layerName: "Ground",
      metadata: { delta: { x: 3, y: 1, z: 0 } }
    });
    const updatedLayer = world.getLayer("Ground");
    assert.ok(updatedLayer !== undefined);
    assert.deepEqual(updatedLayer.position, { x: 5, y: 1, z: 0 });
  });
});

describe("VoxelWorld.apply — position-rebased", () => {
  it("changes the origin without moving the layer contents", () => {
    const world = makeWorld();
    const layer = world.addLayer("Ground");
    layer.setVoxelAt({ x: 8, y: 1, z: 2 }, makeVoxelEntry(7));

    world.apply({
      action: "position-rebased",
      layerName: "Ground",
      metadata: { position: { x: 8, y: 1, z: 2 } }
    });

    assert.deepEqual(layer.position, { x: 8, y: 1, z: 2 });
    assert.equal(layer.getVoxelAt({ x: 8, y: 1, z: 2 })?.blockId, 7);
    assert.ok("0,0,0" in layer.toJSON().voxels);
  });
});

describe("VoxelWorld.apply — reordered", () => {
  it("moves a layer to higher priority", () => {
    const world = makeWorld();
    world.addLayer("Base");
    world.addLayer("Top");
    /*
     * After sort (descending): [Top(order=1), Base(order=0)]
     * Moving Base "up" raises its priority, swapping it with Top.
     */
    world.apply({
      action: "reordered",
      layerName: "Base",
      metadata: { direction: "up" }
    });
    // Base has now overtaken Top in priority
    const layers = world.getLayers();
    assert.equal(layers[0].name, "Base");
    assert.equal(layers[1].name, "Top");
  });
});

describe("VoxelWorld.apply — layer-moved", () => {
  it("moves a layer across the stack in one command", () => {
    const world = makeWorld();
    world.addLayer("A");
    world.addLayer("B");
    world.addLayer("C");
    // After sort (descending): [C, B, A]
    world.apply({
      action: "layer-moved",
      layerName: "C",
      metadata: { toIndex: 2 }
    });

    assert.deepEqual(
      world.getLayers().map((layer) => layer.name),
      ["B", "A", "C"]
    );
  });
});

describe("VoxelWorld.apply — voxel-set", () => {
  it("places a voxel at the given position", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    world.apply({
      action: "voxel-set",
      layerName: "Ground",
      metadata: {
        position: { x: 0, y: 0, z: 0 },
        blockId: 1,
        rotation: 0,
        flipX: false,
        flipZ: false,
        flipY: false
      }
    });
    const layer = world.getLayer("Ground");
    assert.ok(layer !== undefined);
    const entry = layer.getVoxelAt({ x: 0, y: 0, z: 0 });
    assert.ok(entry);
    assert.equal(entry.blockId, 1);
  });

  it("packs rotation and flip flags into the transform", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    world.apply({
      action: "voxel-set",
      layerName: "Ground",
      metadata: {
        position: { x: 1, y: 0, z: 0 },
        blockId: 2,
        rotation: 1,
        flipX: true,
        flipZ: false,
        flipY: false
      }
    });
    const layer = world.getLayer("Ground");
    assert.ok(layer !== undefined);
    const entry = layer.getVoxelAt({ x: 1, y: 0, z: 0 });
    assert.ok(entry);
    assert.equal(entry.transform, new VoxelTransform({ rotation: 1, flipX: true }).packed);
  });
});

describe("VoxelWorld.apply — voxel-removed", () => {
  it("removes the voxel at the given position", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    world.setVoxelAt("Ground", { x: 0, y: 0, z: 0 }, makeVoxelEntry(1, 0));
    world.apply({
      action: "voxel-removed",
      layerName: "Ground",
      metadata: { position: { x: 0, y: 0, z: 0 } }
    });
    const layer = world.getLayer("Ground");
    assert.ok(layer !== undefined);
    assert.equal(
      layer.getVoxelAt({ x: 0, y: 0, z: 0 }),
      undefined
    );
  });
});

describe("VoxelWorld.apply — voxels-set (bulk)", () => {
  it("places all entries in the world", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    const entries = [
      { position: { x: 0, y: 0, z: 0 }, blockId: 1 },
      { position: { x: 1, y: 0, z: 0 }, blockId: 2 },
      { position: { x: 2, y: 0, z: 0 }, blockId: 3 }
    ];
    world.apply({
      action: "voxels-set",
      layerName: "Ground",
      metadata: { entries }
    });
    const layer = world.getLayer("Ground");
    assert.ok(layer !== undefined);
    assert.equal(layer.getVoxelAt({ x: 0, y: 0, z: 0 })?.blockId, 1);
    assert.equal(layer.getVoxelAt({ x: 1, y: 0, z: 0 })?.blockId, 2);
    assert.equal(layer.getVoxelAt({ x: 2, y: 0, z: 0 })?.blockId, 3);
  });

  it("uses default transform when rotation/flip are omitted", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    world.apply({
      action: "voxels-set",
      layerName: "Ground",
      metadata: { entries: [{ position: { x: 0, y: 0, z: 0 }, blockId: 5 }] }
    });
    const layer = world.getLayer("Ground");
    assert.ok(layer !== undefined);
    const entry = layer.getVoxelAt({ x: 0, y: 0, z: 0 });
    assert.ok(entry);
    assert.equal(entry.transform, new VoxelTransform({ rotation: 0 }).packed);
  });
});

describe("VoxelWorld.apply — voxels-removed (bulk)", () => {
  it("removes all specified positions", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    world.setVoxelAt("Ground", { x: 0, y: 0, z: 0 }, makeVoxelEntry(1, 0));
    world.setVoxelAt("Ground", { x: 1, y: 0, z: 0 }, makeVoxelEntry(2, 0));
    world.apply({
      action: "voxels-removed",
      layerName: "Ground",
      metadata: {
        entries: [
          { position: { x: 0, y: 0, z: 0 } },
          { position: { x: 1, y: 0, z: 0 } }
        ]
      }
    });
    const layer = world.getLayer("Ground");
    assert.ok(layer !== undefined);
    assert.equal(layer.getVoxelAt({ x: 0, y: 0, z: 0 }), undefined);
    assert.equal(layer.getVoxelAt({ x: 1, y: 0, z: 0 }), undefined);
  });
});

describe("VoxelWorld.apply — object-layer-added", () => {
  it("creates an object layer", () => {
    const world = makeWorld();
    world.apply({
      action: "object-layer-added",
      layerName: "Spawns",
      metadata: {}
    });
    assert.ok(world.getObjectLayer("Spawns"));
  });
});

describe("VoxelWorld.apply — object-layer-removed", () => {
  it("removes an existing object layer", () => {
    const world = makeWorld();
    world.addObjectLayer("Spawns");
    world.apply({
      action: "object-layer-removed",
      layerName: "Spawns",
      metadata: {}
    });
    assert.equal(world.getObjectLayer("Spawns"), undefined);
  });
});

describe("VoxelWorld.apply — object-layer-updated", () => {
  it("updates object layer visibility", () => {
    const world = makeWorld();
    world.addObjectLayer("Spawns");
    world.apply({
      action: "object-layer-updated",
      layerName: "Spawns",
      metadata: { patch: { visible: false } }
    });
    assert.equal(world.getObjectLayer("Spawns")?.visible, false);
  });
});

describe("VoxelWorld.apply — object-added", () => {
  it("adds an object to the layer", () => {
    const world = makeWorld();
    world.addObjectLayer("Spawns");
    const obj = makeSpawnObject({ name: "Spawn Point", x: 5, y: 0, z: 3 });
    world.apply({
      action: "object-added",
      layerName: "Spawns",
      metadata: { object: obj }
    });
    const layer = world.getObjectLayer("Spawns");
    assert.equal(layer?.objects.length, 1);
    assert.equal(layer?.objects[0].id, "obj1");
  });
});

describe("VoxelWorld.apply — object-removed", () => {
  it("removes an object from the layer", () => {
    const world = makeWorld();
    world.addObjectLayer("Spawns");
    world.addObjectToLayer("Spawns", makeSpawnObject());
    world.apply({
      action: "object-removed",
      layerName: "Spawns",
      metadata: { objectId: "obj1" }
    });
    assert.equal(world.getObjectLayer("Spawns")?.objects.length, 0);
  });
});

describe("VoxelWorld.apply — object-updated", () => {
  it("patches an object in the layer", () => {
    const world = makeWorld();
    world.addObjectLayer("Spawns");
    world.addObjectToLayer("Spawns", makeSpawnObject());
    world.apply({
      action: "object-updated",
      layerName: "Spawns",
      metadata: { objectId: "obj1", patch: { x: 10, visible: false } }
    });
    const obj = world.getObjectLayer("Spawns")?.objects[0];
    assert.equal(obj?.x, 10);
    assert.equal(obj?.visible, false);
  });
});

describe("VoxelWorld.apply — cloned", () => {
  it("clones the layer under its new name", () => {
    const world = makeWorld();
    world.addLayer("Ground", { opacity: 0.5 });

    world.apply({
      action: "cloned",
      layerName: "Ground",
      metadata: { options: { name: "Ground copy" } }
    });

    const clone = world.getLayer("Ground copy");
    assert.ok(clone);
    assert.equal(clone.opacity, 0.5);
  });
});

describe("VoxelWorld.apply — merged", () => {
  it("folds the source layer into the target", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    world.addLayer("Deco");
    world.setVoxelAt("Deco", { x: 2, y: 0, z: 0 }, makeVoxelEntry(9));

    world.apply({
      action: "merged",
      layerName: "Deco",
      metadata: { targetLayerName: "Ground" }
    });

    assert.equal(
      world.getLayer("Ground")?.getVoxelAt({ x: 2, y: 0, z: 0 })?.blockId,
      9
    );
  });
});

describe("VoxelWorld.apply — exhaustiveness", () => {
  it("handles every action the layer command union declares", () => {
    /*
     * Ties this check to the real source of truth instead of a hand-rolled
     * list, so a new/renamed action can't silently drop out of coverage.
     */
    assert.equal(VOXEL_LAYER_COMMAND_ACTIONS.length, 20);

    for (const action of VOXEL_LAYER_COMMAND_ACTIONS) {
      const world = makeWorld();
      world.addLayer("Ground");
      world.addObjectLayer("Ground");

      assert.doesNotThrow(
        () => world.apply(commandFor(action)),
        `action '${action}' is not dispatched`
      );
    }
  });
});

function commandFor(
  action: VoxelLayerCommand["action"]
): VoxelLayerCommand {
  const layerName = "Ground";
  const position = { x: 0, y: 0, z: 0 };

  switch (action) {
    case "added":
    case "updated":
      return { action, layerName, metadata: { options: {} } };
    case "cloned":
      return { action, layerName, metadata: { options: { name: "Copy" } } };
    case "merged":
      return { action, layerName, metadata: { targetLayerName: "Ground" } };
    case "position-updated":
    case "position-rebased":
      return { action, layerName, metadata: { position } };
    case "voxel-set":
      return {
        action,
        layerName,
        metadata: {
          position,
          blockId: 1,
          rotation: 0,
          flipX: false,
          flipZ: false,
          flipY: false
        }
      };
    case "voxel-removed":
      return { action, layerName, metadata: { position } };
    case "voxels-set":
      return {
        action,
        layerName,
        metadata: { entries: [{ position, blockId: 1 }] }
      };
    case "voxels-removed":
      return { action, layerName, metadata: { entries: [{ position }] } };
    case "reordered":
      return { action, layerName, metadata: { direction: "up" } };
    case "layer-moved":
      return { action, layerName, metadata: { toIndex: 0 } };
    case "object-layer-updated":
      return { action, layerName, metadata: { patch: { visible: false } } };
    case "object-added":
      return { action, layerName, metadata: { object: makeSpawnObject() } };
    case "object-removed":
      return { action, layerName, metadata: { objectId: "obj1" } };
    case "object-moved":
      return {
        action,
        layerName,
        metadata: {
          objectId: "obj1",
          fromLayerName: layerName,
          toLayerName: layerName
        }
      };
    case "object-updated":
      return {
        action,
        layerName,
        metadata: { objectId: "obj1", patch: { visible: false } }
      };
    default:
      return { action, layerName, metadata: {} };
  }
}

describe("VoxelWorld.apply — object-moved", () => {
  it("moves the object between object layers", () => {
    const world = makeWorld();
    world.addObjectLayer("From");
    world.addObjectLayer("To");
    world.addObjectToLayer("From", makeSpawnObject());

    world.apply({
      action: "object-moved",
      layerName: "From",
      metadata: {
        objectId: "obj1",
        fromLayerName: "From",
        toLayerName: "To"
      }
    });

    assert.equal(world.getObjectLayer("From")?.objects.length, 0);
    assert.equal(world.getObjectLayer("To")?.objects.length, 1);
  });
});

describe("VoxelWorld.apply — unknown layer", () => {
  const voxelCommands: VoxelLayerCommand[] = [
    {
      action: "voxel-set",
      layerName: "Gone",
      metadata: {
        position: { x: 0, y: 0, z: 0 },
        blockId: 1,
        rotation: 0,
        flipX: false,
        flipZ: false,
        flipY: false
      }
    },
    {
      action: "voxels-set",
      layerName: "Gone",
      metadata: { entries: [{ position: { x: 0, y: 0, z: 0 }, blockId: 1 }] }
    },
    {
      action: "voxel-removed",
      layerName: "Gone",
      metadata: { position: { x: 0, y: 0, z: 0 } }
    },
    {
      action: "voxels-removed",
      layerName: "Gone",
      metadata: { entries: [{ position: { x: 0, y: 0, z: 0 } }] }
    }
  ];

  for (const command of voxelCommands) {
    it(`drops '${command.action}' instead of throwing`, () => {
      const world = makeWorld();

      assert.doesNotThrow(() => world.apply(command));
      assert.equal(world.getLayer("Gone"), undefined);
    });
  }

  it("warns through the logger it is handed", () => {
    const world = makeWorld();
    const warnings: string[] = [];
    const logger = makeLogger(warnings);

    world.apply(voxelCommands[0], logger);

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /dropped 'voxel-set' for unknown layer 'Gone'/);
  });

  it("stays quiet when the layer is known", () => {
    const world = makeWorld();
    world.addLayer("Gone");
    const warnings: string[] = [];

    world.apply(voxelCommands[0], makeLogger(warnings));

    assert.deepEqual(warnings, []);
    assert.equal(
      world.getLayer("Gone")?.getVoxelAt({ x: 0, y: 0, z: 0 })?.blockId,
      1
    );
  });

  it("leaves the layer lifecycle actions to their own guards", () => {
    const world = makeWorld();
    const warnings: string[] = [];
    const logger = makeLogger(warnings);

    assert.doesNotThrow(() => world.apply({
      action: "merged",
      layerName: "Gone",
      metadata: { targetLayerName: "AlsoGone" }
    }, logger));
    assert.deepEqual(warnings, []);
  });
});

function makeLogger(
  warnings: string[]
): VoxelLogger {
  const logger: VoxelLogger = {
    child: () => logger,
    debug: () => void 0,
    warn: (msg) => void warnings.push(msg),
    error: () => void 0
  };

  return logger;
}
