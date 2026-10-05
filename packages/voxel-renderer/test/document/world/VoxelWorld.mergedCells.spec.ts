// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  voxelTransform,
  VoxelWorld,
  type VoxelCoord,
  type VoxelPatch
} from "../../../src/document/world/index.ts";
import { VoxelTransform } from "../../../src/document/geometry/index.ts";

// CONSTANTS
const kLayer = "Ground";
const kStone = 1;
const kWood = 2;
const kGlass = 3;
const kCell: VoxelCoord = {
  x: 1,
  y: 0,
  z: 2
};

function makeWorld(): VoxelWorld {
  const world = new VoxelWorld(4);
  world.addLayer(kLayer);

  return world;
}

function mergeAt(
  world: VoxelWorld
): void {
  world.setVoxel(kLayer, { position: kCell, blockId: kStone });
  world.setVoxel(kLayer, {
    position: kCell,
    blockId: kWood,
    flipY: true,
    merge: true
  });
}

describe("VoxelWorld - merged cells", () => {
  it("adds a merged voxel as the second shape of an occupied cell", () => {
    const world = makeWorld();
    mergeAt(world);

    assert.deepEqual(world.getVoxelAt(kCell), {
      blockId: kStone,
      transform: 0,
      partner: {
        blockId: kWood,
        transform: VoxelTransform.pack({ flipY: true })
      }
    });
    assert.equal(world.getLayer(kLayer)!.voxelCount, 1);
  });

  it("writes a merged voxel into an empty cell as a plain voxel", () => {
    const world = makeWorld();
    world.setVoxel(kLayer, { position: kCell, blockId: kWood, merge: true });

    assert.deepEqual(world.getVoxelAt(kCell), { blockId: kWood, transform: 0 });
  });

  it("replaces both shapes when merging into a cell that is already merged", () => {
    const world = makeWorld();
    mergeAt(world);
    world.setVoxel(kLayer, { position: kCell, blockId: kGlass, merge: true });

    assert.deepEqual(world.getVoxelAt(kCell), { blockId: kGlass, transform: 0 });
  });

  it("replaces both shapes on a plain set", () => {
    const world = makeWorld();
    mergeAt(world);
    world.setVoxel(kLayer, { position: kCell, blockId: kGlass });

    assert.deepEqual(world.getVoxelAt(kCell), { blockId: kGlass, transform: 0 });
  });

  it("removes both shapes with the cell", () => {
    const world = makeWorld();
    mergeAt(world);
    world.removeVoxel(kLayer, { position: kCell });

    assert.equal(world.getVoxelAt(kCell), undefined);
    assert.equal(world.countBlock(kWood), 0);
  });

  it("counts the blocks of both shapes", () => {
    const world = makeWorld();
    mergeAt(world);

    assert.equal(world.countBlock(kStone), 1);
    assert.equal(world.countBlock(kWood), 1);
  });

  it("turns both shapes when the layer is transformed", () => {
    const world = makeWorld();
    mergeAt(world);
    world.transformLayer(kLayer, { rotation: 1 });

    const [[, , , packed, partner]] = world.getLayer(kLayer)!.localVoxels();
    const transforms = [packed, partner].map(voxelTransform).sort();

    assert.deepEqual(transforms, [
      VoxelTransform.pack({ rotation: 1 }),
      VoxelTransform.pack({ rotation: 1, flipY: true })
    ].sort());
  });

  it("keeps the other shape when one shape's block is removed", () => {
    const world = makeWorld();
    mergeAt(world);

    assert.equal(world.removeBlocks([kStone]), 1);
    assert.deepEqual(world.getVoxelAt(kCell), {
      blockId: kWood,
      transform: VoxelTransform.pack({ flipY: true })
    });
  });

  it("keeps both shapes through a template capture and placement", () => {
    const world = makeWorld();
    mergeAt(world);
    const template = world.templates.createFromLayer(kLayer, { name: "Pair" });
    assert.ok(template);

    world.templates.place(template.id, {
      layerName: kLayer,
      position: { x: 0, y: 2, z: 0 }
    });

    const placed = world.getVoxelAt({ x: 0, y: 2, z: 0 });
    assert.deepEqual(placed, world.getVoxelAt(kCell));
    assert.ok(placed?.partner);
  });

  it("publishes a merged cell's partner by its index in the patch", () => {
    const world = makeWorld();
    const patches: VoxelPatch[] = [];
    world.on("command", (command) => {
      if (command.action === "voxels-patched") {
        patches.push(command.metadata);
      }
    });

    world.transaction(() => {
      world.setVoxel(kLayer, { position: { x: 3, y: 0, z: 0 }, blockId: kGlass });
      mergeAt(world);
    });

    assert.deepEqual(patches, [{
      cells: [3, 0, 0, kGlass, 0, kCell.x, kCell.y, kCell.z, kStone, 0],
      partners: [1, kWood, VoxelTransform.pack({ flipY: true })]
    }]);
  });

  it("merges only the cell a patch partner indexes", () => {
    const world = makeWorld();
    world.patchVoxels(
      kLayer,
      [0, 0, 0, kStone, 0, kCell.x, kCell.y, kCell.z, kStone, 0],
      [1, kWood, 0]
    );

    assert.equal(world.getVoxelAt({ x: 0, y: 0, z: 0 })?.partner, undefined);
    assert.equal(world.getVoxelAt(kCell)?.partner?.blockId, kWood);
  });

  it("rejects a patch partner that targets an air cell", () => {
    const world = makeWorld();

    assert.throws(
      () => world.patchVoxels(
        kLayer,
        [kCell.x, kCell.y, kCell.z, 0, 0],
        [0, kWood, 0]
      ),
      /targets cell 0, which writes no voxel/
    );
  });
});
