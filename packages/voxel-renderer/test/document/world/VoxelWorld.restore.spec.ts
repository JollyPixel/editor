// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { rankBetween, VoxelWorld } from "../../../src/document/world/index.ts";
import { deserializeVoxelWorld, serializeVoxelWorld } from "../../../src/document/serialization/index.ts";
import { recordCommands } from "../../helpers/fakes.ts";
import { makeVoxelEntry } from "../../helpers/voxelEntry.ts";

function layerNames(
  world: VoxelWorld
): string[] {
  return world.getLayers().map((layer) => layer.name);
}

describe("VoxelWorld — restore and recording", () => {
  it("restores a layer on top with its id and position, without a command", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");
    const actions: string[] = [];
    world.on("command", (command) => actions.push(command.action));

    const layer = world.restoreLayer({
      id: "layer_42",
      name: "Props",
      position: { x: 4, y: 0, z: 0 }
    });

    assert.equal(world.getLayers()[0], layer);
    assert.equal(layer.id, "layer_42");
    assert.deepEqual(layer.position, { x: 4, y: 0, z: 0 });
    assert.deepEqual(actions, []);
  });

  it("hides edits made while unrecorded from the recorder", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");
    const recorded: number[] = [];
    const recorder = {
      record: (changes: unknown[]) => void recorded.push(changes.length)
    };
    world.addRecorder(recorder);

    world.unrecorded(
      () => world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: 1 })
    );
    world.setVoxel("Ground", { position: { x: 1, y: 0, z: 0 }, blockId: 1 });

    assert.strictEqual(world.removeRecorder(recorder), true);
    assert.deepEqual(recorded, [1]);
  });
});

describe("VoxelWorld — compositing", () => {
  function stacked() {
    const world = new VoxelWorld(4);
    const base = world.addLayer("Base");
    const top = world.addLayer("Top");
    const baseEntry = makeVoxelEntry(1);
    const topEntry = makeVoxelEntry(2);
    base.setVoxelAt({ x: 0, y: 0, z: 0 }, baseEntry);
    top.setVoxelAt({ x: 0, y: 0, z: 0 }, topEntry);

    return { world, base, top, baseEntry, topEntry };
  }

  it("takes the voxel from the highest-priority layer that has one", () => {
    const { world, topEntry } = stacked();

    assert.deepEqual(world.getVoxelAt({ x: 0, y: 0, z: 0 }), topEntry);
  });

  it("falls through to a lower layer where the higher one is empty", () => {
    const world = new VoxelWorld(4);
    const base = world.addLayer("Base");
    world.addLayer("Top");
    const entry = makeVoxelEntry(1);
    base.setVoxelAt({ x: 5, y: 0, z: 0 }, entry);

    assert.deepEqual(world.getVoxelAt({ x: 5, y: 0, z: 0 }), entry);
  });

  it("skips an invisible layer", () => {
    const { world, top, baseEntry } = stacked();
    top.visible = false;

    assert.deepEqual(world.getVoxelAt({ x: 0, y: 0, z: 0 }), baseEntry);
  });

  it("names the layer the winning voxel came from", () => {
    const { world, top, base, topEntry } = stacked();

    const winner = world.getVoxelWithLayerAt({ x: 0, y: 0, z: 0 });
    assert.deepEqual(winner?.entry, topEntry);
    assert.equal(winner?.layer, top);

    top.visible = false;
    assert.equal(world.getVoxelWithLayerAt({ x: 0, y: 0, z: 0 })?.layer, base);
  });
});

describe("VoxelWorld — chunk size", () => {
  it("defaults to 16 and takes any power of two", () => {
    assert.equal(new VoxelWorld().chunkSize, 16);
    assert.equal(new VoxelWorld(8).chunkSize, 8);
  });

  it("rejects a size that is not a power of two", () => {
    assert.throws(
      () => new VoxelWorld(10),
      /chunkSize must be a power of two, received 10/
    );
  });
});

describe("VoxelWorld — layer identity", () => {
  it("gives new layers distinct ids and stacks them on top", () => {
    const world = new VoxelWorld(4);
    const a = world.addLayer("A");
    const b = world.addLayer("B");

    assert.notStrictEqual(a.id, b.id);
    assert.ok(b.rank > a.rank);
    assert.deepEqual(layerNames(world), ["B", "A"]);
  });

  it("applies concurrent moves of different layers in either order to the same stack", () => {
    const seed = new VoxelWorld(4);
    ["A", "B", "C"].forEach((name) => seed.addLayer(name));
    const moves = [
      {
        action: "layer-moved",
        layerId: seed.getLayer("A")!.id,
        metadata: { rank: rankBetween(seed.getLayer("C")!.rank, null) }
      },
      {
        action: "layer-moved",
        layerId: seed.getLayer("C")!.id,
        metadata: { rank: rankBetween(null, seed.getLayer("A")!.rank) }
      }
    ] as const;
    const first = new VoxelWorld(4);
    const second = new VoxelWorld(4);
    deserializeVoxelWorld(serializeVoxelWorld(seed), first);
    deserializeVoxelWorld(serializeVoxelWorld(seed), second);

    moves.forEach((move) => first.applyCommand(move));
    [...moves].reverse().forEach((move) => second.applyCommand(move));

    assert.deepEqual(layerNames(first), ["A", "B", "C"]);
    assert.deepEqual(layerNames(second), layerNames(first));
  });

  it("renames a layer while commands keep addressing it by id", () => {
    const world = new VoxelWorld(4);
    const layer = world.addLayer("Ground");
    const commands = recordCommands(world);

    assert.strictEqual(world.updateLayer("Ground", { name: "Floor" }), true);
    world.applyCommand({
      action: "voxels-set",
      layerId: layer.id,
      metadata: { entries: [{ position: { x: 0, y: 0, z: 0 }, blockId: 2 }] }
    });

    assert.strictEqual(world.getLayer("Floor"), layer);
    assert.strictEqual(layer.getVoxelAt({ x: 0, y: 0, z: 0 })?.blockId, 2);
    assert.deepEqual(commands, [
      { action: "updated", layerId: layer.id, metadata: { options: { name: "Floor" } } }
    ]);
  });

  it("places a clone directly above its source", () => {
    const world = new VoxelWorld(4);
    world.addLayer("A");
    world.addLayer("B");

    const clone = world.cloneLayer("A");

    assert.strictEqual(clone?.name, "A (1)");
    assert.deepEqual(layerNames(world), ["B", "A (1)", "A"]);
  });
});
