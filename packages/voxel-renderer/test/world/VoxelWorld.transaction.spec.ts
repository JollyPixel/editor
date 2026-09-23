// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  VoxelWorld,
  voxelPatchCells,
  type VoxelCoord
} from "../../src/world/index.ts";
import { VoxelHistory } from "../../src/history/index.ts";
import type { VoxelLayerCommand } from "../../src/commands.ts";
import { recordCommands } from "../helpers/fakes.ts";
import { clearAllDirty } from "../helpers/world.ts";

// CONSTANTS
const kLayer = "Ground";
const kOrigin = { x: 0, y: 0, z: 0 };

function makeWorld(): {
  world: VoxelWorld;
  commands: VoxelLayerCommand[];
} {
  const world = new VoxelWorld(4);
  world.addLayer(kLayer);

  return { world, commands: recordCommands(world) };
}

function patchOf(
  command: VoxelLayerCommand | undefined
): unknown[] {
  assert.equal(command?.action, "voxels-patched");

  return [...voxelPatchCells(command.metadata.cells)];
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

/**
 * Seeds every layer, clears the dirty flags, then writes `cells` into layer
 * "A" with or without a transaction and lists the chunks left dirty.
 */
function dirtyAfterWrites(
  positions: Record<string, VoxelCoord>,
  cells: VoxelCoord[],
  batched: boolean
): string[] {
  const world = new VoxelWorld(4);
  for (const [name, position] of Object.entries(positions)) {
    world.addLayer(name);
    world.setLayerPosition(name, position);
    for (const cell of randomCells(200, name.charCodeAt(0))) {
      world.setVoxelAt(name, cell, { blockId: 1, transform: 0 });
    }
  }
  clearAllDirty(world);

  function write(): void {
    for (const cell of cells) {
      world.setVoxel("A", { position: cell, blockId: 2 });
    }
  }
  if (batched) {
    world.transaction(write);
  }
  else {
    write();
  }

  return dirtyChunks(world);
}

describe("VoxelWorld.transaction", () => {
  it("applies writes immediately and returns the callback result", () => {
    const { world } = makeWorld();

    const result = world.transaction(() => {
      world.setVoxel(kLayer, { position: kOrigin, blockId: 3 });

      return world.getVoxelAt(kOrigin)?.blockId;
    });

    assert.equal(result, 3);
  });

  it("emits one patch per layer, last write wins", () => {
    const { world, commands } = makeWorld();
    world.addLayer("Top");
    commands.length = 0;

    world.transaction(() => {
      world.setVoxel(kLayer, { position: kOrigin, blockId: 3 });
      world.setVoxel("Top", { position: { x: 5, y: 0, z: 0 }, blockId: 7 });
      world.setVoxel(kLayer, { position: kOrigin, blockId: 4, rotation: 1 });
      world.setVoxelBulk(kLayer, [{ position: { x: 1, y: 2, z: 3 }, blockId: 9 }]);
    });

    assert.deepEqual(commands.map(({ layerName }) => layerName), [kLayer, "Top"]);
    assert.deepEqual(patchOf(commands[0]), [
      { x: 0, y: 0, z: 0, blockId: 4, transform: 1 },
      { x: 1, y: 2, z: 3, blockId: 9, transform: 0 }
    ]);
    assert.deepEqual(patchOf(commands[1]), [
      { x: 5, y: 0, z: 0, blockId: 7, transform: 0 }
    ]);
  });

  it("encodes a removal as block 0 and drops cells that end unchanged", () => {
    const { world, commands } = makeWorld();
    world.setVoxelAt(kLayer, kOrigin, { blockId: 2, transform: 0 });

    world.transaction(() => {
      world.removeVoxel(kLayer, { position: kOrigin });
      world.setVoxel(kLayer, { position: { x: 1, y: 0, z: 0 }, blockId: 5 });
      world.removeVoxelBulk(kLayer, [{ position: { x: 1, y: 0, z: 0 } }]);
    });

    assert.equal(commands.length, 1);
    assert.deepEqual(patchOf(commands[0]), [
      { x: 0, y: 0, z: 0, blockId: 0, transform: 0 }
    ]);
  });

  it("emits nothing when no cell changed", () => {
    const { world, commands } = makeWorld();

    world.transaction(() => {
      world.setVoxel(kLayer, { position: kOrigin, blockId: 2 });
      world.removeVoxel(kLayer, { position: kOrigin });
    });

    assert.deepEqual(commands, []);
  });

  it("flushes once when the outermost transaction ends", () => {
    const { world, commands } = makeWorld();

    world.transaction(() => {
      world.transaction(() => {
        world.setVoxel(kLayer, { position: kOrigin, blockId: 2 });
      });
      assert.deepEqual(commands, []);
      world.setVoxel(kLayer, { position: { x: 1, y: 0, z: 0 }, blockId: 2 });
    });

    assert.equal(commands.length, 1);
    assert.equal(patchOf(commands[0]).length, 2);
  });

  it("flushes pending cells ahead of a structural command", () => {
    const { world, commands } = makeWorld();

    world.transaction(() => {
      world.setVoxel(kLayer, { position: kOrigin, blockId: 2 });
      world.translateLayer(kLayer, { x: 4, y: 0, z: 0 });
      world.setVoxel(kLayer, { position: kOrigin, blockId: 3 });
    });

    assert.deepEqual(
      commands.map(({ action }) => action),
      ["voxels-patched", "position-updated", "voxels-patched"]
    );
    assert.deepEqual(patchOf(commands[0]), [
      { x: 0, y: 0, z: 0, blockId: 2, transform: 0 }
    ]);
    assert.deepEqual(patchOf(commands[2]), [
      { x: 0, y: 0, z: 0, blockId: 3, transform: 0 }
    ]);

    const remote = new VoxelWorld(4);
    remote.addLayer(kLayer);
    for (const command of commands) {
      remote.apply(command);
    }
    assert.deepEqual(
      remote.getLayer(kLayer)?.toJSON().voxels,
      world.getLayer(kLayer)?.toJSON().voxels
    );
  });

  it("still flushes when the callback throws", () => {
    const { world, commands } = makeWorld();

    assert.throws(() => world.transaction(() => {
      world.setVoxel(kLayer, { position: kOrigin, blockId: 2 });
      throw new Error("boom");
    }), /boom/);

    assert.equal(commands.length, 1);
  });

  it("throws on a write to an unknown layer and ignores a removal", () => {
    const { world } = makeWorld();

    assert.throws(
      () => world.transaction(() => world.setVoxel("NoSuch", { position: kOrigin, blockId: 1 })),
      /layer "NoSuch" does not exist/
    );
    assert.doesNotThrow(
      () => world.transaction(() => world.removeVoxel("NoSuch", { position: kOrigin }))
    );
  });

  it("stays quiet inside silently()", () => {
    const { world, commands } = makeWorld();
    const history = new VoxelHistory(world, { enabled: true });

    world.silently(() => world.transaction(() => {
      world.setVoxel(kLayer, { position: kOrigin, blockId: 2 });
    }));

    assert.deepEqual(commands, []);
    assert.equal(history.canUndo, false);
    assert.equal(world.getVoxelAt(kOrigin)?.blockId, 2);
  });
});

describe("VoxelWorld.transaction - dirty chunks", () => {
  it("dirties exactly what per-voxel writes dirty on aligned layers", () => {
    const layers = { A: kOrigin, B: kOrigin, C: kOrigin };
    const cells = [...randomCells(300, 7)];

    assert.deepEqual(
      dirtyAfterWrites(layers, cells, true),
      dirtyAfterWrites(layers, cells, false)
    );
  });

  it("dirties at least what per-voxel writes dirty on offset layers", () => {
    const layers = {
      A: { x: 1, y: 0, z: -3 },
      B: { x: -2, y: 1, z: 5 },
      C: kOrigin
    };
    const cells = [...randomCells(300, 11)];

    const batched = new Set(dirtyAfterWrites(layers, cells, true));
    const missing = dirtyAfterWrites(layers, cells, false)
      .filter((key) => !batched.has(key));

    assert.deepEqual(missing, []);
  });

  it("dirties the neighbour chunk of a boundary write in another layer", () => {
    const world = new VoxelWorld(4);
    world.addLayer("A");
    const other = world.addLayer("B");
    other.getOrCreateChunk(1, 0, 0);
    other.getOrCreateChunk(2, 0, 0);
    clearAllDirty(world);

    world.transaction(() => {
      world.setVoxel("A", { position: { x: 3, y: 0, z: 0 }, blockId: 1 });
    });

    assert.equal(other.getChunk(1, 0, 0)?.dirty, true);
    assert.equal(other.getChunk(2, 0, 0)?.dirty, false);
  });
});

describe("VoxelWorld.transaction - history", () => {
  it("records the whole transaction as one undo step", () => {
    const { world } = makeWorld();
    const history = new VoxelHistory(world, { enabled: true });
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
    const history = new VoxelHistory(world, { enabled: true });
    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });

    world.transaction(() => history.undo());

    assert.equal(world.getVoxelAt(kOrigin), undefined);
    assert.equal(history.canUndo, false);
    assert.equal(history.canRedo, true);
  });
});

describe("VoxelWorld.patchVoxels", () => {
  it("rejects a patch whose length is not a whole number of cells", () => {
    const { world } = makeWorld();

    assert.throws(() => world.patchVoxels(kLayer, [0, 0, 0, 1]), RangeError);
  });

  it("applies a remote patch without echoing it", () => {
    const { world, commands } = makeWorld();

    world.apply({
      action: "voxels-patched",
      layerName: kLayer,
      metadata: { cells: [0, 0, 0, 2, 3] }
    });

    assert.deepEqual(world.getVoxelAt(kOrigin), { blockId: 2, transform: 3 });
    assert.deepEqual(commands, []);
  });
});
