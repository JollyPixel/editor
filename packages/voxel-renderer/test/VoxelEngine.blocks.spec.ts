// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { VoxelEngine } from "../src/VoxelEngine.ts";
import { makeBlockDef } from "./helpers/blocks.ts";
import { recordCommands } from "./helpers/fakes.ts";
import {
  makeEngine,
  placeCube
} from "./helpers/engine.ts";
import {
  CUBE_ID as kCubeId,
  LEAVES_ID as kLeavesId
} from "./helpers/ids.ts";

function makeMeshedEngine(): VoxelEngine {
  const engine = makeEngine({ layers: ["Ground"] });
  placeCube(engine, "Ground", { x: 0, y: 0, z: 0 });
  engine.tick(0);

  return engine;
}

function anyChunkDirty(
  engine: VoxelEngine
): boolean {
  return [...engine.world.getAllChunks()].some(({ chunk }) => chunk.dirty);
}

describe("VoxelEngine - block definitions", () => {
  it("registers a definition, marks the chunks dirty and emits the resolved one", () => {
    const engine = makeMeshedEngine();
    const commands = recordCommands(engine);

    engine.defineBlock(makeBlockDef(kLeavesId, "cube", { name: "Leaves" }));

    assert.deepEqual(commands, [
      { action: "block-defined", block: engine.blockRegistry.get(kLeavesId) }
    ]);
    assert.equal(engine.blockRegistry.get(kLeavesId)?.name, "Leaves");
    assert.ok([...engine.world.getAllChunks()].every(({ chunk }) => chunk.dirty));
  });

  it("emits once per block of a batch, and nothing for an empty one", () => {
    const engine = makeEngine();
    const commands = recordCommands(engine);

    engine.defineBlocks([]);
    engine.defineBlocks([
      makeBlockDef(kLeavesId, "cube"),
      makeBlockDef(5, "cube")
    ]);

    assert.equal(commands.length, 2);
  });

  it("removes a definition and reports the removal", () => {
    const engine = makeEngine();
    const commands = recordCommands(engine);

    assert.equal(engine.removeBlock(kCubeId), true);
    assert.equal(engine.removeBlock(99), false);

    assert.equal(engine.blockRegistry.has(kCubeId), false);
    assert.deepEqual(commands.map(({ action }) => action), ["block-removed"]);
  });
});

describe("VoxelEngine - block lookup by position", () => {
  it("joins a placed voxel to its definition and properties", () => {
    const engine = makeEngine({ layers: ["Ground"] });
    engine.defineBlock(
      makeBlockDef(kLeavesId, "cube", {
        name: "Leaves",
        properties: { hardness: 1, flammable: true }
      })
    );
    placeCube(engine, "Ground", { x: 1, y: 2, z: 3 }, kLeavesId);

    assert.equal(engine.blockAt({ x: 1, y: 2, z: 3 })?.name, "Leaves");
    assert.deepEqual(
      engine.blockPropertiesAt({ x: 1, y: 2, z: 3 }),
      { hardness: 1, flammable: true }
    );
  });

  it("hands out a copy that does not write back into the registry", () => {
    const engine = makeEngine({ layers: ["Ground"] });
    engine.defineBlock(
      makeBlockDef(kLeavesId, "cube", { properties: { hardness: 1 } })
    );
    placeCube(engine, "Ground", { x: 0, y: 0, z: 0 }, kLeavesId);

    engine.blockPropertiesAt({ x: 0, y: 0, z: 0 })!.hardness = 99;

    assert.deepEqual(engine.blockPropertiesAt({ x: 0, y: 0, z: 0 }), { hardness: 1 });
  });

  it("reports air and a voxel whose block was unregistered as absent", () => {
    const engine = makeEngine({ layers: ["Ground"] });
    placeCube(engine, "Ground", { x: 0, y: 0, z: 0 });
    engine.removeBlock(kCubeId);

    for (const position of [{ x: 9, y: 9, z: 9 }, { x: 0, y: 0, z: 0 }]) {
      assert.equal(engine.blockAt(position), undefined);
      assert.equal(engine.blockPropertiesAt(position), undefined);
    }
  });
});

describe("VoxelEngine - block order", () => {
  function ids(
    engine: VoxelEngine
  ): number[] {
    return [...engine.blockRegistry].map((block) => block.id);
  }

  it("moves a block and emits the resolved index", () => {
    const engine = makeEngine();
    engine.defineBlock(makeBlockDef(kLeavesId, "cube"));
    const commands = recordCommands(engine);

    assert.equal(engine.moveBlock(kCubeId, 99), true);

    assert.deepEqual(ids(engine), [kLeavesId, kCubeId]);
    assert.deepEqual(commands, [
      {
        action: "block-moved",
        blockId: kCubeId,
        toIndex: 1
      }
    ]);
  });

  it("stays silent when nothing moves", () => {
    const engine = makeEngine();
    const commands = recordCommands(engine);

    assert.equal(engine.moveBlock(kCubeId, 0), false);
    assert.equal(engine.moveBlock(404, 0), false);

    assert.deepEqual(commands, []);
  });

  it("leaves the meshes untouched", () => {
    const engine = makeMeshedEngine();
    engine.defineBlock(makeBlockDef(kLeavesId, "cube"));
    engine.tick(0);

    engine.moveBlock(kCubeId, 1);

    assert.equal(anyChunkDirty(engine), false);
  });
});
