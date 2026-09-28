// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { VoxelView } from "../../src/view/VoxelView.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import { recordCommands } from "../helpers/fakes.ts";
import {
  makeView,
  placeCube
} from "../helpers/view.ts";
import {
  CUBE_ID as kCubeId,
  LEAVES_ID as kLeavesId
} from "../helpers/ids.ts";

function makeMeshedView(): VoxelView {
  const view = makeView({ layers: ["Ground"] });
  placeCube(view, "Ground", { x: 0, y: 0, z: 0 });
  view.tick(0);

  return view;
}

function anyChunkDirty(
  view: VoxelView
): boolean {
  return [...view.document.world.getAllChunks()].some(({ chunk }) => chunk.dirty);
}

describe("VoxelView - block definitions", () => {
  it("registers a definition, marks the chunks dirty and emits the resolved one", () => {
    const view = makeMeshedView();
    const commands = recordCommands(view.document);

    view.document.defineBlock(makeBlockDef(kLeavesId, "cube", { name: "Leaves" }));

    assert.deepEqual(commands, [
      { action: "block-defined", block: view.document.blocks.get(kLeavesId) }
    ]);
    assert.equal(view.document.blocks.get(kLeavesId)?.name, "Leaves");
    assert.ok([...view.document.world.getAllChunks()].every(({ chunk }) => chunk.dirty));
  });

  it("emits once per block of a batch, and nothing for an empty one", () => {
    const view = makeView();
    const commands = recordCommands(view.document);

    view.document.defineBlocks([]);
    view.document.defineBlocks([
      makeBlockDef(kLeavesId, "cube"),
      makeBlockDef(5, "cube")
    ]);

    assert.equal(commands.length, 2);
  });

  it("removes a definition and reports the removal", () => {
    const view = makeView();
    const commands = recordCommands(view.document);

    assert.equal(view.document.removeBlock(kCubeId), true);
    assert.equal(view.document.removeBlock(99), false);

    assert.equal(view.document.blocks.has(kCubeId), false);
    assert.deepEqual(commands.map(({ action }) => action), ["block-removed"]);
  });
});

describe("VoxelView - block lookup by position", () => {
  it("joins a placed voxel to its definition and properties", () => {
    const view = makeView({ layers: ["Ground"] });
    view.document.defineBlock(
      makeBlockDef(kLeavesId, "cube", {
        name: "Leaves",
        properties: { hardness: 1, flammable: true }
      })
    );
    placeCube(view, "Ground", { x: 1, y: 2, z: 3 }, kLeavesId);

    assert.equal(view.document.blockAt({ x: 1, y: 2, z: 3 })?.name, "Leaves");
    assert.deepEqual(
      view.document.blockPropertiesAt({ x: 1, y: 2, z: 3 }),
      { hardness: 1, flammable: true }
    );
  });

  it("hands out a copy that does not write back into the registry", () => {
    const view = makeView({ layers: ["Ground"] });
    view.document.defineBlock(
      makeBlockDef(kLeavesId, "cube", { properties: { hardness: 1 } })
    );
    placeCube(view, "Ground", { x: 0, y: 0, z: 0 }, kLeavesId);

    view.document.blockPropertiesAt({ x: 0, y: 0, z: 0 })!.hardness = 99;

    assert.deepEqual(view.document.blockPropertiesAt({ x: 0, y: 0, z: 0 }), { hardness: 1 });
  });

  it("reports air and a voxel whose block was unregistered as absent", () => {
    const view = makeView({ layers: ["Ground"] });
    placeCube(view, "Ground", { x: 0, y: 0, z: 0 });
    view.document.removeBlock(kCubeId);

    for (const position of [{ x: 9, y: 9, z: 9 }, { x: 0, y: 0, z: 0 }]) {
      assert.equal(view.document.blockAt(position), undefined);
      assert.equal(view.document.blockPropertiesAt(position), undefined);
    }
  });
});

describe("VoxelView - block order", () => {
  function ids(
    view: VoxelView
  ): number[] {
    return [...view.document.blocks].map((block) => block.id);
  }

  it("moves a block and emits the resolved index", () => {
    const view = makeView();
    view.document.defineBlock(makeBlockDef(kLeavesId, "cube"));
    const commands = recordCommands(view.document);

    assert.equal(view.document.moveBlock(kCubeId, 99), true);

    assert.deepEqual(ids(view), [kLeavesId, kCubeId]);
    assert.deepEqual(commands, [
      {
        action: "block-moved",
        blockId: kCubeId,
        toIndex: 1
      }
    ]);
  });

  it("stays silent when nothing moves", () => {
    const view = makeView();
    const commands = recordCommands(view.document);

    assert.equal(view.document.moveBlock(kCubeId, 0), false);
    assert.equal(view.document.moveBlock(404, 0), false);

    assert.deepEqual(commands, []);
  });

  it("leaves the meshes untouched", () => {
    const view = makeMeshedView();
    view.document.defineBlock(makeBlockDef(kLeavesId, "cube"));
    view.tick(0);

    view.document.moveBlock(kCubeId, 1);

    assert.equal(anyChunkDirty(view), false);
  });
});
