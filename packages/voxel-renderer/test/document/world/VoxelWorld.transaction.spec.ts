// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  VoxelWorld,
  voxelPatchCells,
  type VoxelCoord
} from "../../../src/document/world/index.ts";
import { VoxelHistory } from "../../../src/document/VoxelHistory.ts";
import {
  isVoxelLayerCommand,
  type VoxelWorldContentCommand
} from "../../../src/document/commands/index.ts";
import { recordCommands } from "../../helpers/fakes.ts";
import {
  clearAllDirty,
  voxelContent,
  writeVoxel
} from "../../helpers/world.ts";

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

function patchOf(
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

    assert.deepEqual(
      commands.filter(isVoxelLayerCommand).map(
        (command) => ("layerId" in command ? world.getLayerById(command.layerId)?.name : null)
      ),
      [kLayer, "Top"]
    );
    assert.deepEqual(patchOf(commands[0]), [
      { x: 0, y: 0, z: 0, blockId: 4, transform: 1 },
      { x: 1, y: 2, z: 3, blockId: 9, transform: 0 }
    ]);
    assert.deepEqual(patchOf(commands[1]), [
      { x: 5, y: 0, z: 0, blockId: 7, transform: 0 }
    ]);
  });

  it("keeps first-write order and last values for every cell of a chunk", () => {
    const { world, commands } = makeWorld();
    const cells: VoxelCoord[] = [];
    for (let z = 0; z < 4; z++) {
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          cells.push({ x: 3 - x, y, z });
        }
      }
    }

    world.transaction(() => {
      for (const position of cells) {
        world.setVoxel(kLayer, { position, blockId: 2 });
      }
      for (const position of cells.toReversed()) {
        world.setVoxel(kLayer, { position, blockId: 3 });
      }
    });

    assert.equal(commands.length, 1);
    assert.deepEqual(
      patchOf(commands[0]),
      cells.map((position) => {
        return { ...position, blockId: 3, transform: 0 };
      })
    );
  });

  it("encodes a removal as block 0 and drops cells that end unchanged", () => {
    const { world, commands } = makeWorld();
    writeVoxel(world, kLayer, kOrigin, { blockId: 2, transform: 0 });

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
    remote.restoreLayer({ id: world.getLayer(kLayer)!.id, name: kLayer });
    for (const command of commands) {
      remote.apply(command);
    }
    assert.deepEqual(
      voxelContent(remote.getLayer(kLayer)!),
      voxelContent(world.getLayer(kLayer)!)
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
    const history = new VoxelHistory(world, { enabled: true });
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
    assert.deepEqual(patchOf(commands[0]), [
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
