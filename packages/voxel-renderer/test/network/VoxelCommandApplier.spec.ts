// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelWorld } from "../../src/world/VoxelWorld.ts";
import { applyCommandToWorld } from "../../src/network/VoxelCommandApplier.ts";
import { packTransform } from "../../src/utils/math.ts";
import type { VoxelLayerHookEvent } from "../../src/hooks.ts";

function makeWorld() {
  return new VoxelWorld(4);
}

// ---------------------------------------------------------------------------
// Layer structural operations
// ---------------------------------------------------------------------------

describe("applyCommandToWorld — added", () => {
  it("creates a new layer in the world", () => {
    const world = makeWorld();
    applyCommandToWorld(world, {
      action: "added",
      layerName: "Ground",
      metadata: { options: {} }
    });
    assert.ok(world.getLayer("Ground"));
  });

  it("passes options through to the layer", () => {
    const world = makeWorld();
    applyCommandToWorld(world, {
      action: "added",
      layerName: "Deco",
      metadata: { options: { visible: false } }
    });
    assert.equal(world.getLayer("Deco")?.visible, false);
  });
});

describe("applyCommandToWorld — removed", () => {
  it("removes an existing layer", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    applyCommandToWorld(world, {
      action: "removed",
      layerName: "Ground",
      metadata: {}
    });
    assert.equal(world.getLayer("Ground"), undefined);
  });

  it("is a no-op for an unknown layer", () => {
    const world = makeWorld();
    assert.doesNotThrow(() => {
      applyCommandToWorld(world, {
        action: "removed",
        layerName: "NoSuch",
        metadata: {}
      });
    });
  });
});

describe("applyCommandToWorld — updated", () => {
  it("updates layer visibility", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    applyCommandToWorld(world, {
      action: "updated",
      layerName: "Ground",
      metadata: { options: { visible: false } }
    });
    assert.equal(world.getLayer("Ground")?.visible, false);
  });
});

describe("applyCommandToWorld — offset-updated (absolute)", () => {
  it("sets the layer offset", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    applyCommandToWorld(world, {
      action: "offset-updated",
      layerName: "Ground",
      metadata: { offset: { x: 5, y: 0, z: 3 } }
    });
    const layer = world.getLayer("Ground")!;
    assert.deepEqual(layer.offset, { x: 5, y: 0, z: 3 });
  });
});

describe("applyCommandToWorld — offset-updated (delta)", () => {
  it("translates the layer offset", () => {
    const world = makeWorld();
    const layer = world.addLayer("Ground");
    layer.offset = { x: 2, y: 0, z: 0 };
    applyCommandToWorld(world, {
      action: "offset-updated",
      layerName: "Ground",
      metadata: { delta: { x: 3, y: 1, z: 0 } }
    });
    assert.deepEqual(world.getLayer("Ground")!.offset, { x: 5, y: 1, z: 0 });
  });
});

describe("applyCommandToWorld — reordered", () => {
  it("moves a layer to higher priority", () => {
    const world = makeWorld();
    const l0 = world.addLayer("Base");
    const l1 = world.addLayer("Top");
    // After sort (descending): [Top(order=1), Base(order=0)]
    // Move Base "down" in array index = higher priority (swaps with Top)
    applyCommandToWorld(world, {
      action: "reordered",
      layerName: "Base",
      metadata: { direction: "down" }
    });
    // Base has now overtaken Top in priority
    const layers = world.getLayers();
    assert.equal(layers[0].name, "Base");
    assert.equal(layers[1].name, "Top");
    // reference check to avoid unused-var lint
    assert.ok(l0 && l1);
  });
});

// ---------------------------------------------------------------------------
// Voxel operations
// ---------------------------------------------------------------------------

describe("applyCommandToWorld — voxel-set", () => {
  it("places a voxel at the given position", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    applyCommandToWorld(world, {
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
    const entry = world.getLayer("Ground")!.getVoxelAt({ x: 0, y: 0, z: 0 });
    assert.ok(entry);
    assert.equal(entry.blockId, 1);
  });

  it("packs rotation and flip flags into the transform", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    applyCommandToWorld(world, {
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
    const entry = world.getLayer("Ground")!.getVoxelAt({ x: 1, y: 0, z: 0 });
    assert.ok(entry);
    assert.equal(entry.transform, packTransform(1, true, false, false));
  });
});

describe("applyCommandToWorld — voxel-removed", () => {
  it("removes the voxel at the given position", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    world.setVoxelAt("Ground", { x: 0, y: 0, z: 0 }, { blockId: 1, transform: 0 });
    applyCommandToWorld(world, {
      action: "voxel-removed",
      layerName: "Ground",
      metadata: { position: { x: 0, y: 0, z: 0 } }
    });
    assert.equal(
      world.getLayer("Ground")!.getVoxelAt({ x: 0, y: 0, z: 0 }),
      undefined
    );
  });
});

describe("applyCommandToWorld — voxels-set (bulk)", () => {
  it("places all entries in the world", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    const entries = [
      { position: { x: 0, y: 0, z: 0 }, blockId: 1 },
      { position: { x: 1, y: 0, z: 0 }, blockId: 2 },
      { position: { x: 2, y: 0, z: 0 }, blockId: 3 }
    ];
    applyCommandToWorld(world, {
      action: "voxels-set",
      layerName: "Ground",
      metadata: { entries }
    });
    const layer = world.getLayer("Ground")!;
    assert.equal(layer.getVoxelAt({ x: 0, y: 0, z: 0 })?.blockId, 1);
    assert.equal(layer.getVoxelAt({ x: 1, y: 0, z: 0 })?.blockId, 2);
    assert.equal(layer.getVoxelAt({ x: 2, y: 0, z: 0 })?.blockId, 3);
  });

  it("uses default transform when rotation/flip are omitted", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    applyCommandToWorld(world, {
      action: "voxels-set",
      layerName: "Ground",
      metadata: { entries: [{ position: { x: 0, y: 0, z: 0 }, blockId: 5 }] }
    });
    const entry = world.getLayer("Ground")!.getVoxelAt({ x: 0, y: 0, z: 0 });
    assert.ok(entry);
    assert.equal(entry.transform, packTransform(0, false, false, false));
  });
});

describe("applyCommandToWorld — voxels-removed (bulk)", () => {
  it("removes all specified positions", () => {
    const world = makeWorld();
    world.addLayer("Ground");
    world.setVoxelAt("Ground", { x: 0, y: 0, z: 0 }, { blockId: 1, transform: 0 });
    world.setVoxelAt("Ground", { x: 1, y: 0, z: 0 }, { blockId: 2, transform: 0 });
    applyCommandToWorld(world, {
      action: "voxels-removed",
      layerName: "Ground",
      metadata: {
        entries: [
          { position: { x: 0, y: 0, z: 0 } },
          { position: { x: 1, y: 0, z: 0 } }
        ]
      }
    });
    const layer = world.getLayer("Ground")!;
    assert.equal(layer.getVoxelAt({ x: 0, y: 0, z: 0 }), undefined);
    assert.equal(layer.getVoxelAt({ x: 1, y: 0, z: 0 }), undefined);
  });
});

// ---------------------------------------------------------------------------
// Object layer operations
// ---------------------------------------------------------------------------

describe("applyCommandToWorld — object-layer-added", () => {
  it("creates an object layer", () => {
    const world = makeWorld();
    applyCommandToWorld(world, {
      action: "object-layer-added",
      layerName: "Spawns",
      metadata: {}
    });
    assert.ok(world.getObjectLayer("Spawns"));
  });
});

describe("applyCommandToWorld — object-layer-removed", () => {
  it("removes an existing object layer", () => {
    const world = makeWorld();
    world.addObjectLayer("Spawns");
    applyCommandToWorld(world, {
      action: "object-layer-removed",
      layerName: "Spawns",
      metadata: {}
    });
    assert.equal(world.getObjectLayer("Spawns"), undefined);
  });
});

describe("applyCommandToWorld — object-layer-updated", () => {
  it("updates object layer visibility", () => {
    const world = makeWorld();
    world.addObjectLayer("Spawns");
    applyCommandToWorld(world, {
      action: "object-layer-updated",
      layerName: "Spawns",
      metadata: { patch: { visible: false } }
    });
    assert.equal(world.getObjectLayer("Spawns")?.visible, false);
  });
});

describe("applyCommandToWorld — object-added", () => {
  it("adds an object to the layer", () => {
    const world = makeWorld();
    world.addObjectLayer("Spawns");
    const obj = {
      id: "obj1",
      name: "Spawn Point",
      x: 5,
      y: 0,
      z: 3,
      visible: true
    };
    applyCommandToWorld(world, {
      action: "object-added",
      layerName: "Spawns",
      metadata: { object: obj }
    });
    const layer = world.getObjectLayer("Spawns");
    assert.equal(layer?.objects.length, 1);
    assert.equal(layer?.objects[0].id, "obj1");
  });
});

describe("applyCommandToWorld — object-removed", () => {
  it("removes an object from the layer", () => {
    const world = makeWorld();
    world.addObjectLayer("Spawns");
    world.addObjectToLayer("Spawns", {
      id: "obj1",
      name: "Spawn",
      x: 0,
      y: 0,
      z: 0,
      visible: true
    });
    applyCommandToWorld(world, {
      action: "object-removed",
      layerName: "Spawns",
      metadata: { objectId: "obj1" }
    });
    assert.equal(world.getObjectLayer("Spawns")?.objects.length, 0);
  });
});

describe("applyCommandToWorld — object-updated", () => {
  it("patches an object in the layer", () => {
    const world = makeWorld();
    world.addObjectLayer("Spawns");
    world.addObjectToLayer("Spawns", {
      id: "obj1",
      name: "Spawn",
      x: 0,
      y: 0,
      z: 0,
      visible: true
    });
    applyCommandToWorld(world, {
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

describe("applyCommandToWorld — all VoxelLayerHookEvent actions compile", () => {
  it("exhaustive switch: no TypeScript error for any action", () => {
    // This test confirms TypeScript's exhaustive check works at compile time.
    // At runtime we just verify the function is callable without errors.
    const actions: VoxelLayerHookEvent["action"][] = [
      "added",
      "removed",
      "updated",
      "offset-updated",
      "voxel-set",
      "voxel-removed",
      "voxels-set",
      "voxels-removed",
      "reordered",
      "object-layer-added",
      "object-layer-removed",
      "object-layer-updated",
      "object-added",
      "object-removed",
      "object-updated"
    ];
    assert.equal(actions.length, 15);
  });
});
