// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  VoxelWorld,
  type VoxelCoord,
  voxelPatchCells
} from "../../../src/document/world/index.ts";
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

function readPatch(
  command: VoxelWorldContentCommand | undefined
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

describe("VoxelWorld.patchVoxels", () => {
  it("rejects a patch whose length is not a whole number of cells", () => {
    const { world } = makeWorld();

    assert.throws(() => world.patchVoxels(kLayer, [0, 0, 0, 1]), RangeError);
  });

  it("emits a copy of the cells as given in one patch", () => {
    const { world, commands } = makeWorld();
    const cells = [
      0, 0, 0, 2, 0,
      1, 0, 0, 3, 1,
      0, 0, 0, 4, 0
    ];

    world.patchVoxels(kLayer, cells);

    const [command] = commands;
    assert.equal(commands.length, 1);
    assert.equal(command?.action, "voxels-patched");
    assert.equal(command.layerId, world.getLayer(kLayer)!.id);
    assert.deepEqual(command.metadata.cells, cells);
    assert.notEqual(command.metadata.cells, cells);
    assert.equal(world.getVoxelAt(kOrigin)?.blockId, 4);
    assert.deepEqual(
      world.getVoxelAt({ x: 1, y: 0, z: 0 }),
      { blockId: 3, transform: 1 }
    );
  });

  it("emits nothing for an empty patch", () => {
    const { world, commands } = makeWorld();

    world.patchVoxels(kLayer, []);

    assert.deepEqual(commands, []);
  });

  it("dirties exactly what the same writes dirty in a transaction", () => {
    const layers = {
      A: { x: 1, y: 0, z: -3 },
      B: { x: -2, y: 1, z: 5 },
      C: kOrigin
    };
    const cells = [...randomCells(300, 13)];

    assert.deepEqual(
      dirtyAfterWrites(layers, cells, "patch"),
      dirtyAfterWrites(layers, cells, "transaction")
    );
  });

  it("joins an enclosing transaction", () => {
    const { world, commands } = makeWorld();

    world.transaction(() => {
      world.setVoxel(kLayer, { position: kOrigin, blockId: 2 });
      world.patchVoxels(kLayer, [0, 0, 0, 0, 0]);
    });

    assert.deepEqual(commands, []);
    assert.equal(world.getVoxelAt(kOrigin), undefined);
  });

  it("records one undo step when the history is enabled", () => {
    const { world } = makeWorld();
    const history = worldHistory(world);
    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });

    world.patchVoxels(kLayer, [
      0, 0, 0, 2, 0,
      0, 0, 0, 3, 0,
      1, 0, 0, 4, 0
    ]);
    history.undo();

    assert.equal(world.getVoxelAt(kOrigin)?.blockId, 1);
    assert.equal(world.getVoxelAt({ x: 1, y: 0, z: 0 }), undefined);
    assert.equal(history.canUndo, true);
  });

  it("emits the cells written before an invalid block id", () => {
    const { world, commands } = makeWorld();
    clearAllDirty(world);

    assert.throws(
      () => world.patchVoxels(kLayer, [
        0, 0, 0, 2, 0,
        1, 0, 0, -5, 0
      ]),
      RangeError
    );

    assert.equal(commands.length, 1);
    assert.deepEqual(readPatch(commands[0]), [
      { x: 0, y: 0, z: 0, blockId: 2, transform: 0 }
    ]);
    assert.deepEqual(dirtyChunks(world), [`${kLayer}:0,0,0`]);
  });

  it("throws on an unknown layer and ignores a removal", () => {
    const { world, commands } = makeWorld();

    assert.throws(
      () => world.patchVoxels("NoSuch", [0, 0, 0, 1, 0]),
      /layer "NoSuch" does not exist/
    );
    assert.doesNotThrow(() => world.patchVoxels("NoSuch", [0, 0, 0, 0, 0]));
    assert.deepEqual(commands, []);
  });

  it("stays quiet inside silently()", () => {
    const { world, commands } = makeWorld();

    world.silently(() => world.patchVoxels(kLayer, [0, 0, 0, 2, 0]));

    assert.deepEqual(commands, []);
    assert.equal(world.getVoxelAt(kOrigin)?.blockId, 2);
  });
});
