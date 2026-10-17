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
import { isVoxelLayerCommand, type VoxelWorldContentCommand } from "../../../src/document/commands/index.ts";
import { recordCommands } from "../../helpers/fakes.ts";
import { voxelContent, writeVoxel } from "../../helpers/world.ts";

// CONSTANTS
const kLayer = "Ground";
const kOrigin = { x: 0, y: 0, z: 0 };

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
    assert.deepEqual(readPatch(commands[0]), [
      { x: 0, y: 0, z: 0, blockId: 4, transform: 1 },
      { x: 1, y: 2, z: 3, blockId: 9, transform: 0 }
    ]);
    assert.deepEqual(readPatch(commands[1]), [
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
      readPatch(commands[0]),
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
    assert.deepEqual(readPatch(commands[0]), [
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
    assert.equal(readPatch(commands[0]).length, 2);
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
    assert.deepEqual(readPatch(commands[0]), [
      { x: 0, y: 0, z: 0, blockId: 2, transform: 0 }
    ]);
    assert.deepEqual(readPatch(commands[2]), [
      { x: 0, y: 0, z: 0, blockId: 3, transform: 0 }
    ]);

    const remote = new VoxelWorld(4);
    remote.restoreLayer({ id: world.getLayer(kLayer)!.id, name: kLayer });
    for (const command of commands) {
      remote.applyCommand(command);
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
    const history = worldHistory(world);

    world.silently(() => world.transaction(() => {
      world.setVoxel(kLayer, { position: kOrigin, blockId: 2 });
    }));

    assert.deepEqual(commands, []);
    assert.equal(history.canUndo, false);
    assert.equal(world.getVoxelAt(kOrigin)?.blockId, 2);
  });
});
