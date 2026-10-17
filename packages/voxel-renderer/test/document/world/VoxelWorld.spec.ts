// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelWorld } from "../../../src/document/world/index.ts";
import { FACE } from "../../../src/document/geometry/faceDirection.ts";
import type { VoxelWorldContentCommand } from "../../../src/document/commands/index.ts";
import { makeVoxelEntry } from "../../helpers/voxelEntry.ts";
import { eraseVoxel, writeVoxel } from "../../helpers/world.ts";

function layerNames(
  world: VoxelWorld
): string[] {
  return world.getLayers().map((layer) => layer.name);
}

describe("VoxelWorld — layer lifecycle", () => {
  it("starts empty and finds a layer back by name", () => {
    const world = new VoxelWorld(4);
    assert.equal(world.getLayers().length, 0);

    const layer = world.addLayer("Ground");

    assert.equal(layer.name, "Ground");
    assert.equal(world.getLayer("Ground"), layer);
    assert.equal(world.getLayer("NoSuchLayer"), undefined);
  });

  it("hands layers back highest-priority first", () => {
    const world = new VoxelWorld(4);
    const base = world.addLayer("Base");
    const top = world.addLayer("Top");

    assert.deepEqual(world.getLayers(), [top, base]);
  });

  it("removes a layer and reports whether there was one", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");

    assert.equal(world.removeLayer("Ground"), true);
    assert.equal(world.getLayer("Ground"), undefined);
    assert.equal(world.getLayers().length, 0);

    assert.equal(world.removeLayer("Ground"), false);
  });

  it("drops every layer, and the removals still pending, on clear", () => {
    const world = new VoxelWorld(4);
    world.addLayer("A");
    world.addLayer("B");
    writeVoxel(world, "A", { x: 0, y: 0, z: 0 }, makeVoxelEntry());
    world.removeLayer("A");

    world.clear();

    assert.equal(world.getLayers().length, 0);
    assert.deepEqual([...world.getAllChunksToBeRemoved()], []);
  });
});

describe("VoxelWorld — layer ordering", () => {
  it("stacks a layer added after a removal on top, with dense orders", () => {
    const world = new VoxelWorld(4);
    for (const name of ["A", "B", "C"]) {
      world.addLayer(name);
    }

    world.removeLayer("A");
    world.addLayer("D");

    assert.deepEqual(
      world.getLayers().map((layer) => [layer.name, layer.order]),
      [["D", 2], ["C", 1], ["B", 0]]
    );
  });

  it("swaps a layer's priority with its neighbour in the stack", () => {
    const world = new VoxelWorld(4);
    const base = world.addLayer("Base");
    const top = world.addLayer("Top");

    world.moveLayer("Top", "down");
    assert.deepEqual([top.order, base.order], [0, 1]);

    world.moveLayer("Top", "up");
    assert.deepEqual([top.order, base.order], [1, 0]);
  });

  it("stays put at either end of the stack, or for an unknown name", () => {
    const world = new VoxelWorld(4);
    const only = world.addLayer("Only");
    const { order } = only;

    world.moveLayer("Only", "up");
    world.moveLayer("Only", "down");
    assert.doesNotThrow(() => world.moveLayer("NoSuch", "up"));

    assert.equal(only.order, order);
  });

  it("moves a layer to an absolute position in the stack", () => {
    const world = new VoxelWorld(4);
    world.addLayer("A");
    world.addLayer("B");
    world.addLayer("C");
    assert.deepEqual(layerNames(world), ["C", "B", "A"]);

    world.moveLayerTo("C", 2);
    assert.deepEqual(layerNames(world), ["B", "A", "C"]);

    world.moveLayerTo("A", 0);
    assert.deepEqual(layerNames(world), ["A", "B", "C"]);
  });

  it("re-ranks order densely and descending after an absolute move", () => {
    const world = new VoxelWorld(4);
    world.addLayer("A");
    world.addLayer("B");
    world.addLayer("C");

    world.moveLayerTo("C", 2);

    assert.deepEqual(
      world.getLayers().map((layer) => layer.order),
      [2, 1, 0]
    );
  });

  it("clamps an out-of-range index to the ends of the stack", () => {
    const world = new VoxelWorld(4);
    world.addLayer("A");
    world.addLayer("B");
    world.addLayer("C");

    world.moveLayerTo("C", 99);
    assert.deepEqual(layerNames(world), ["B", "A", "C"]);

    world.moveLayerTo("C", -4);
    assert.deepEqual(layerNames(world), ["C", "B", "A"]);
  });

  it("emits nothing for a move that changes nothing, or an unknown name", () => {
    const world = new VoxelWorld(4);
    world.addLayer("A");
    world.addLayer("B");

    const actions: string[] = [];
    world.on("command", (event) => actions.push(event.action));

    world.moveLayerTo("B", 0);
    world.moveLayerTo("NoSuch", 1);
    world.moveLayer("A", "down");
    world.moveLayer("B", "up");

    assert.deepEqual(actions, []);
  });

  it("emits the rank that places the layer at the clamped index", () => {
    const world = new VoxelWorld(4);
    const a = world.addLayer("A");
    const b = world.addLayer("B");

    const events: VoxelWorldContentCommand[] = [];
    world.on("command", (event) => events.push(event));

    world.moveLayerTo("B", 99);

    assert.deepEqual(events, [
      {
        action: "layer-moved",
        layerId: b.id,
        metadata: { rank: b.rank }
      }
    ]);
    assert.ok(b.rank < a.rank);
    assert.deepEqual(layerNames(world), ["A", "B"]);
  });
});

describe("VoxelWorld — voxel access", () => {
  it("round-trips a voxel through the named layer", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");
    const entry = makeVoxelEntry(5);

    writeVoxel(world, "Ground", { x: 2, y: 1, z: 3 }, entry);
    assert.deepEqual(world.getVoxelAt({ x: 2, y: 1, z: 3 }), entry);

    eraseVoxel(world, "Ground", { x: 2, y: 1, z: 3 });
    assert.equal(world.getVoxelAt({ x: 2, y: 1, z: 3 }), undefined);
  });

  it("reads nothing out of an empty world", () => {
    const world = new VoxelWorld(4);

    assert.equal(world.getVoxelAt({ x: 0, y: 0, z: 0 }), undefined);
    assert.equal(world.getVoxelWithLayerAt({ x: 0, y: 0, z: 0 }), undefined);
    assert.equal(world.getVoxelNeighbour({ x: 0, y: 0, z: 0 }, FACE.PosX), undefined);
  });

  it("never hands out a layer id that a restored layer already holds", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Loaded").id = "layer_1";

    const added = world.addLayer("Added");

    assert.notEqual(added.id, "layer_1");
    assert.equal(new Set(world.getLayers().map((layer) => layer.id)).size, 2);
  });

  it("emits nothing for an erase aimed at a layer that does not exist", () => {
    const world = new VoxelWorld(4);
    const actions: string[] = [];
    world.on("command", (command) => actions.push(command.action));

    world.removeVoxel("NoSuch", { position: { x: 0, y: 0, z: 0 } });
    world.removeVoxelBulk("NoSuch", [{ position: { x: 0, y: 0, z: 0 } }]);

    assert.deepEqual(actions, []);
  });

  it("refuses to write to a layer that does not exist, but tolerates erasing from one", () => {
    const world = new VoxelWorld(4);

    assert.throws(
      () => world.setVoxel("NoSuch", { position: { x: 0, y: 0, z: 0 }, blockId: 1 }),
      /layer "NoSuch" does not exist/
    );
    assert.doesNotThrow(
      () => world.removeVoxel("NoSuch", { position: { x: 0, y: 0, z: 0 } })
    );
  });

  it("steps one cell along a face to reach a neighbour", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");
    const entry = makeVoxelEntry(3);
    writeVoxel(world, "Ground", { x: 1, y: 0, z: 0 }, entry);

    assert.deepEqual(
      world.getVoxelNeighbour({ x: 0, y: 0, z: 0 }, FACE.PosX),
      entry
    );
  });
});
