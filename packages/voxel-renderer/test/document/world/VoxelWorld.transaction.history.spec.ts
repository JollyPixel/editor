// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelWorld, type VoxelCoord } from "../../../src/document/world/index.ts";
import { worldHistory } from "../../helpers/history.ts";
import { type VoxelWorldContentCommand } from "../../../src/document/commands/index.ts";
import { recordCommands } from "../../helpers/fakes.ts";
import { clearAllDirty, writeVoxel } from "../../helpers/world.ts";

// CONSTANTS
const kLayer = "Ground";
const kOrigin = { x: 0, y: 0, z: 0 };

type WriteMode = "direct" | "transaction" | "patch";

function makeWorld(): {
  world: VoxelWorld;
  commands: VoxelWorldContentCommand[];
} {
  const world = new VoxelWorld(4);
  world.addLayer(kLayer);

  return { world, commands: recordCommands(world) };
}

function dirtyChunks(
  world: VoxelWorld
): string[] {
  const keys: string[] = [];
  for (const { layer, chunk } of world.getAllChunks()) {
    if (chunk.dirty) {
      keys.push(`${layer.name}:${chunk.cx},${chunk.cy},${chunk.cz}`);
    }
  }

  return keys.sort();
}

function* randomCells(
  count: number,
  seed: number
): IterableIterator<VoxelCoord> {
  let state = seed;
  function next(
    span: number
  ): number {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;

    return (state % span) - (span / 2);
  }
  for (let index = 0; index < count; index++) {
    yield { x: next(24), y: next(8), z: next(24) };
  }
}

function dirtyAfterWrites(
  positions: Record<string, VoxelCoord>,
  cells: VoxelCoord[],
  mode: WriteMode
): string[] {
  const world = new VoxelWorld(4);
  for (const [name, position] of Object.entries(positions)) {
    world.addLayer(name);
    world.setLayerPosition(name, position);
    for (const cell of randomCells(200, name.charCodeAt(0))) {
      writeVoxel(world, name, cell, { blockId: 1, transform: 0 });
    }
  }
  clearAllDirty(world);

  function write(): void {
    for (const cell of cells) {
      world.setVoxel("A", { position: cell, blockId: 2 });
    }
  }
  if (mode === "transaction") {
    world.transaction(write);
  }
  else if (mode === "patch") {
    world.patchVoxels("A", cells.flatMap(({ x, y, z }) => [x, y, z, 2, 0]));
  }
  else {
    write();
  }

  return dirtyChunks(world);
}

describe("VoxelWorld.transaction - dirty chunks", () => {
  it("dirties exactly what per-voxel writes dirty on aligned layers", () => {
    const layers = { A: kOrigin, B: kOrigin, C: kOrigin };
    const cells = [...randomCells(300, 7)];

    assert.deepEqual(
      dirtyAfterWrites(layers, cells, "transaction"),
      dirtyAfterWrites(layers, cells, "direct")
    );
  });

  it("dirties at least what per-voxel writes dirty on offset layers", () => {
    const layers = {
      A: { x: 1, y: 0, z: -3 },
      B: { x: -2, y: 1, z: 5 },
      C: kOrigin
    };
    const cells = [...randomCells(300, 11)];

    const batched = new Set(dirtyAfterWrites(layers, cells, "transaction"));
    const missing = dirtyAfterWrites(layers, cells, "direct")
      .filter((key) => !batched.has(key));

    assert.deepEqual(missing, []);
  });
});

describe("VoxelWorld.transaction - history", () => {
  it("records the whole transaction as one undo step", () => {
    const { world } = makeWorld();
    const history = worldHistory(world);
    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });

    world.transaction(() => {
      world.setVoxel(kLayer, { position: kOrigin, blockId: 2 });
      world.setVoxel(kLayer, { position: kOrigin, blockId: 3 });
      world.setVoxel(kLayer, { position: { x: 1, y: 0, z: 0 }, blockId: 4 });
    });
    history.undo();

    assert.equal(world.getVoxelAt(kOrigin)?.blockId, 1);
    assert.equal(world.getVoxelAt({ x: 1, y: 0, z: 0 }), undefined);
    assert.equal(history.canUndo, true);
  });

  it("does not record an undo replayed inside a transaction", () => {
    const { world } = makeWorld();
    const history = worldHistory(world);
    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });

    world.transaction(() => history.undo());

    assert.equal(world.getVoxelAt(kOrigin), undefined);
    assert.equal(history.canUndo, false);
    assert.equal(history.canRedo, true);
  });
});
