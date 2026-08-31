// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelWorld } from "../../src/world/VoxelWorld.ts";
import { VoxelTransform } from "../../src/world/VoxelTransform.ts";
import { VOXEL_LAYER_HOOK_ACTIONS, type VoxelLayerHookEvent } from "../../src/hooks.ts";
import type { VoxelObjectJSON } from "../../src/serialization/types.ts";
import { makeVoxelEntry } from "../helpers/voxelEntry.ts";
import { makeAddedCommand } from "../helpers/networkCommands.ts";

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

// ---------------------------------------------------------------------------
// Layer structural operations
// ---------------------------------------------------------------------------

describe("VoxelWorld.applyRemoteCommand — added", () => {
  it("creates a new layer in the world", () => {
    const world = makeWorld();
    world.applyRemoteCommand(makeAddedCommand("Ground"));
    assert.ok(world.getLayer("Ground"));
  });

  it("passes options through to the layer", () => {
    const world = makeWorld();
    world.applyRemoteCommand({
      action: "added",
      layerName: "Deco",
      metadata: { options: { visible: false } }
    });
    assert.equal(world.getLayer("Deco")?.visible, false);
  });
});

describe("VoxelWorld.applyRemoteCommand — removed", () => {
  it("removes an existing layer", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    world.applyRemoteCommand({
      action: "removed",
      layerName: "Ground",
      metadata: {}
    });
    assert.equal(world.getLayer("Ground"), undefined);
  });

  it("is a no-op for an unknown layer", () => {
    const world = makeWorld();
    assert.doesNotThrow(() => {
      world.applyRemoteCommand({
        action: "removed",
        layerName: "NoSuch",
        metadata: {}
      });
    });
  });
});

describe("VoxelWorld.applyRemoteCommand — updated", () => {
  it("updates layer visibility", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    world.applyRemoteCommand({
      action: "updated",
      layerName: "Ground",
      metadata: { options: { visible: false } }
    });
    assert.equal(world.getLayer("Ground")?.visible, false);
  });
});

describe("VoxelWorld.applyRemoteCommand — offset-updated (absolute)", () => {
  it("sets the layer offset", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    world.applyRemoteCommand({
      action: "offset-updated",
      layerName: "Ground",
      metadata: { offset: { x: 5, y: 0, z: 3 } }
    });
    const layer = world.getLayer("Ground");
    assert.ok(layer !== undefined);
    assert.deepEqual(layer.offset, { x: 5, y: 0, z: 3 });
  });
});

describe("VoxelWorld.applyRemoteCommand — offset-updated (delta)", () => {
  it("translates the layer offset", () => {
    const world = makeWorld();
    const layer = world.addLayer("Ground");
    layer.offset = { x: 2, y: 0, z: 0 };
    world.applyRemoteCommand({
      action: "offset-updated",
      layerName: "Ground",
      metadata: { delta: { x: 3, y: 1, z: 0 } }
    });
    const updatedLayer = world.getLayer("Ground");
    assert.ok(updatedLayer !== undefined);
    assert.deepEqual(updatedLayer.offset, { x: 5, y: 1, z: 0 });
  });
});

describe("VoxelWorld.applyRemoteCommand — reordered", () => {
  it("moves a layer to higher priority", () => {
    const world = makeWorld();
    world.addLayer("Base");
    world.addLayer("Top");
    // After sort (descending): [Top(order=1), Base(order=0)]
    // Move Base "down" in array index = higher priority (swaps with Top)
    world.applyRemoteCommand({
      action: "reordered",
      layerName: "Base",
      metadata: { direction: "down" }
    });
    // Base has now overtaken Top in priority
    const layers = world.getLayers();
    assert.equal(layers[0].name, "Base");
    assert.equal(layers[1].name, "Top");
  });
});

// ---------------------------------------------------------------------------
// Voxel operations
// ---------------------------------------------------------------------------

describe("VoxelWorld.applyRemoteCommand — voxel-set", () => {
  it("places a voxel at the given position", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    world.applyRemoteCommand({
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
    world.applyRemoteCommand({
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

describe("VoxelWorld.applyRemoteCommand — voxel-removed", () => {
  it("removes the voxel at the given position", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    world.setVoxelAt("Ground", { x: 0, y: 0, z: 0 }, makeVoxelEntry(1, 0));
    world.applyRemoteCommand({
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

describe("VoxelWorld.applyRemoteCommand — voxels-set (bulk)", () => {
  it("places all entries in the world", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    const entries = [
      { position: { x: 0, y: 0, z: 0 }, blockId: 1 },
      { position: { x: 1, y: 0, z: 0 }, blockId: 2 },
      { position: { x: 2, y: 0, z: 0 }, blockId: 3 }
    ];
    world.applyRemoteCommand({
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
    world.applyRemoteCommand({
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

describe("VoxelWorld.applyRemoteCommand — voxels-removed (bulk)", () => {
  it("removes all specified positions", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    world.setVoxelAt("Ground", { x: 0, y: 0, z: 0 }, makeVoxelEntry(1, 0));
    world.setVoxelAt("Ground", { x: 1, y: 0, z: 0 }, makeVoxelEntry(2, 0));
    world.applyRemoteCommand({
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

// ---------------------------------------------------------------------------
// Object layer operations
// ---------------------------------------------------------------------------

describe("VoxelWorld.applyRemoteCommand — object-layer-added", () => {
  it("creates an object layer", () => {
    const world = makeWorld();
    world.applyRemoteCommand({
      action: "object-layer-added",
      layerName: "Spawns",
      metadata: {}
    });
    assert.ok(world.getObjectLayer("Spawns"));
  });
});

describe("VoxelWorld.applyRemoteCommand — object-layer-removed", () => {
  it("removes an existing object layer", () => {
    const world = makeWorld();
    world.addObjectLayer("Spawns");
    world.applyRemoteCommand({
      action: "object-layer-removed",
      layerName: "Spawns",
      metadata: {}
    });
    assert.equal(world.getObjectLayer("Spawns"), undefined);
  });
});

describe("VoxelWorld.applyRemoteCommand — object-layer-updated", () => {
  it("updates object layer visibility", () => {
    const world = makeWorld();
    world.addObjectLayer("Spawns");
    world.applyRemoteCommand({
      action: "object-layer-updated",
      layerName: "Spawns",
      metadata: { patch: { visible: false } }
    });
    assert.equal(world.getObjectLayer("Spawns")?.visible, false);
  });
});

describe("VoxelWorld.applyRemoteCommand — object-added", () => {
  it("adds an object to the layer", () => {
    const world = makeWorld();
    world.addObjectLayer("Spawns");
    const obj = makeSpawnObject({ name: "Spawn Point", x: 5, y: 0, z: 3 });
    world.applyRemoteCommand({
      action: "object-added",
      layerName: "Spawns",
      metadata: { object: obj }
    });
    const layer = world.getObjectLayer("Spawns");
    assert.equal(layer?.objects.length, 1);
    assert.equal(layer?.objects[0].id, "obj1");
  });
});

describe("VoxelWorld.applyRemoteCommand — object-removed", () => {
  it("removes an object from the layer", () => {
    const world = makeWorld();
    world.addObjectLayer("Spawns");
    world.addObjectToLayer("Spawns", makeSpawnObject());
    world.applyRemoteCommand({
      action: "object-removed",
      layerName: "Spawns",
      metadata: { objectId: "obj1" }
    });
    assert.equal(world.getObjectLayer("Spawns")?.objects.length, 0);
  });
});

describe("VoxelWorld.applyRemoteCommand — object-updated", () => {
  it("patches an object in the layer", () => {
    const world = makeWorld();
    world.addObjectLayer("Spawns");
    world.addObjectToLayer("Spawns", makeSpawnObject());
    world.applyRemoteCommand({
      action: "object-updated",
      layerName: "Spawns",
      metadata: { objectId: "obj1", patch: { x: 10, visible: false } }
    });
    const obj = world.getObjectLayer("Spawns")?.objects[0];
    assert.equal(obj?.x, 10);
    assert.equal(obj?.visible, false);
  });
});

// ---------------------------------------------------------------------------
// Round-trip: all actions covered
// ---------------------------------------------------------------------------

describe("VoxelWorld.applyRemoteCommand — cloned", () => {
  it("clones the layer under its new name", () => {
    const world = makeWorld();
    world.addLayer("Ground", { opacity: 0.5 });

    world.applyRemoteCommand({
      action: "cloned",
      layerName: "Ground",
      metadata: { options: { name: "Ground copy" } }
    });

    const clone = world.getLayer("Ground copy");
    assert.ok(clone);
    assert.equal(clone.opacity, 0.5);
  });
});

describe("VoxelWorld.applyRemoteCommand — merged", () => {
  it("folds the source layer into the target", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    world.addLayer("Deco");
    world.setVoxelAt("Deco", { x: 2, y: 0, z: 0 }, makeVoxelEntry(9));

    world.applyRemoteCommand({
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

describe("VoxelWorld.applyRemoteCommand — exhaustiveness", () => {
  it("handles every action the hook union declares", () => {
    // Ties this check to the real source of truth instead of a hand-rolled
    // list, so a new/renamed action can't silently drop out of coverage.
    assert.equal(VOXEL_LAYER_HOOK_ACTIONS.length, 17);

    for (const action of VOXEL_LAYER_HOOK_ACTIONS) {
      const world = makeWorld();
      world.addLayer("Ground");
      world.addObjectLayer("Ground");

      assert.doesNotThrow(
        () => world.applyRemoteCommand(commandFor(action)),
        `action '${action}' is not dispatched`
      );
    }
  });
});

function commandFor(
  action: VoxelLayerHookEvent["action"]
): VoxelLayerHookEvent {
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
    case "offset-updated":
      return { action, layerName, metadata: { offset: position } };
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
    case "object-layer-updated":
      return { action, layerName, metadata: { patch: { visible: false } } };
    case "object-added":
      return { action, layerName, metadata: { object: makeSpawnObject() } };
    case "object-removed":
      return { action, layerName, metadata: { objectId: "obj1" } };
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
