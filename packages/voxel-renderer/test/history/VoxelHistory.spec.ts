// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  VoxelHistory,
  type VoxelHistoryState
} from "../../src/history/index.ts";
import {
  VoxelWorld,
  type VoxelCellChange
} from "../../src/world/index.ts";
import type { VoxelLayerCommand } from "../../src/commands.ts";
import { makeEngine } from "../helpers/engine.ts";

// CONSTANTS
const kLayer = "Ground";
const kOrigin = { x: 0, y: 0, z: 0 };
const kNext = { x: 1, y: 0, z: 0 };

function makeHistory(
  limit?: number
): { world: VoxelWorld; history: VoxelHistory; } {
  const world = new VoxelWorld(4);
  world.addLayer(kLayer);
  const history = new VoxelHistory(world, {
    enabled: true,
    limit
  });

  return { world, history };
}

function blockAt(
  world: VoxelWorld,
  position = kOrigin
): number | undefined {
  return world.getLayer(kLayer)?.getVoxelAt(position)?.blockId;
}

describe("VoxelHistory", () => {
  it("records nothing and leaves the world untouched when disabled", () => {
    const world = new VoxelWorld(4);
    world.addLayer(kLayer);
    const history = new VoxelHistory(world);

    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });

    assert.equal(history.enabled, false);
    assert.equal(world.recorder, null);
    assert.equal(history.canUndo, false);
    assert.equal(history.undo(), false);
    assert.equal(blockAt(world), 1);
  });

  it("rejects a limit that is not a positive integer", () => {
    const world = new VoxelWorld(4);

    assert.throws(
      () => new VoxelHistory(world, { enabled: true, limit: 0 }),
      RangeError
    );
    assert.throws(
      () => new VoxelHistory(world, { enabled: true, limit: 1.5 }),
      RangeError
    );
  });

  it("undoes and redoes a placement", () => {
    const { world, history } = makeHistory();

    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });
    assert.equal(history.undo(), true);
    assert.equal(blockAt(world), undefined);
    assert.equal(history.canRedo, true);

    assert.equal(history.redo(), true);
    assert.equal(blockAt(world), 1);
    assert.equal(history.canRedo, false);
  });

  it("restores the previous block and transform on undo", () => {
    const { world, history } = makeHistory();
    world.silently(() => world.setVoxel(kLayer, {
      position: kOrigin,
      blockId: 1,
      rotation: 1,
      flipY: true
    }));

    world.setVoxelBulk(kLayer, [{ position: kOrigin, blockId: 2 }]);
    history.undo();

    const entry = world.getLayer(kLayer)?.getVoxelAt(kOrigin);
    assert.equal(entry?.blockId, 1);
    assert.equal(entry?.transform, 0b10001);
  });

  it("brings removed voxels back on undo", () => {
    const { world, history } = makeHistory();
    world.silently(() => world.setVoxelBulk(kLayer, [
      { position: kOrigin, blockId: 1 },
      { position: kNext, blockId: 2 }
    ]));

    world.removeVoxelBulk(kLayer, [
      { position: kOrigin },
      { position: kNext }
    ]);
    history.undo();

    assert.equal(blockAt(world, kOrigin), 1);
    assert.equal(blockAt(world, kNext), 2);
  });

  it("ignores writes that change nothing", () => {
    const { world, history } = makeHistory();

    world.removeVoxel(kLayer, { position: kOrigin });

    assert.equal(history.canUndo, false);
  });

  it("merges every edit between begin and commit into one entry", () => {
    const { world, history } = makeHistory();

    history.begin();
    world.setVoxelBulk(kLayer, [{ position: kOrigin, blockId: 1 }]);
    world.setVoxelBulk(kLayer, [{ position: kNext, blockId: 1 }]);
    world.setVoxelBulk(kLayer, [{ position: kOrigin, blockId: 2 }]);
    assert.equal(history.canUndo, false);
    history.commit();

    assert.equal(history.canUndo, true);
    history.undo();
    assert.equal(blockAt(world, kOrigin), undefined);
    assert.equal(blockAt(world, kNext), undefined);
    assert.equal(history.canUndo, false);

    history.redo();
    assert.equal(blockAt(world, kOrigin), 2);
    assert.equal(blockAt(world, kNext), 1);
  });

  it("drops a group whose edits cancel out", () => {
    const { world, history } = makeHistory();

    history.begin();
    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });
    world.removeVoxel(kLayer, { position: kOrigin });
    history.commit();

    assert.equal(history.canUndo, false);
  });

  it("only closes the group on the outermost commit", () => {
    const { world, history } = makeHistory();

    history.begin();
    history.begin();
    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });
    history.commit();
    assert.equal(history.canUndo, false);
    history.commit();

    assert.equal(history.canUndo, true);
  });

  it("refuses to undo while a group is open", () => {
    const { world, history } = makeHistory();
    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });

    history.begin();

    assert.equal(history.undo(), false);
    assert.equal(blockAt(world), 1);
  });

  it("drops the oldest entry past the limit", () => {
    const { world, history } = makeHistory(2);

    for (const blockId of [1, 2, 3]) {
      world.setVoxel(kLayer, { position: kOrigin, blockId });
    }

    assert.equal(history.undo(), true);
    assert.equal(history.undo(), true);
    assert.equal(history.undo(), false);
    assert.equal(blockAt(world), 1);
  });

  it("clears the redo stack on a new edit", () => {
    const { world, history } = makeHistory();
    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });
    history.undo();

    world.setVoxel(kLayer, { position: kNext, blockId: 1 });

    assert.equal(history.canRedo, false);
  });

  it("does not record silent (remote) edits", () => {
    const { world, history } = makeHistory();

    world.apply({
      action: "voxel-set",
      layerName: kLayer,
      metadata: {
        position: kOrigin,
        blockId: 1,
        rotation: 0,
        flipX: false,
        flipZ: false,
        flipY: false
      }
    });

    assert.equal(history.canUndo, false);
  });

  it("keeps cells a peer changed since the edit", () => {
    const { world, history } = makeHistory();
    world.setVoxelBulk(kLayer, [
      { position: kOrigin, blockId: 1 },
      { position: kNext, blockId: 1 }
    ]);

    world.silently(() => world.setVoxel(kLayer, {
      position: kNext,
      blockId: 3
    }));
    history.undo();

    assert.equal(blockAt(world, kOrigin), undefined);
    assert.equal(blockAt(world, kNext), 3);
  });

  it("skips cells whose layer no longer exists", () => {
    const { world, history } = makeHistory();
    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });
    world.removeLayer(kLayer);

    assert.equal(history.undo(), true);
    assert.equal(history.canRedo, true);
  });

  it("emits replayed changes as regular commands without recording them", () => {
    const { world, history } = makeHistory();
    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });
    const commands: VoxelLayerCommand[] = [];
    world.on("command", (command) => commands.push(command));

    history.undo();

    assert.deepEqual(commands.map((command) => command.action), [
      "voxels-removed"
    ]);
    assert.equal(history.canRedo, true);
    assert.equal(history.canUndo, false);
  });

  it("emits the undo/redo state on every change", () => {
    const { world, history } = makeHistory();
    const states: VoxelHistoryState[] = [];
    history.on("change", (state) => states.push(state));

    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });
    history.undo();
    history.redo();
    history.clear();

    assert.deepEqual(states, [
      { canUndo: true, canRedo: false },
      { canUndo: false, canRedo: true },
      { canUndo: true, canRedo: false },
      { canUndo: false, canRedo: false }
    ]);
  });

  it("detaches from the world on dispose", () => {
    const { world, history } = makeHistory();

    history.dispose();
    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });

    assert.equal(world.recorder, null);
    assert.equal(history.canUndo, false);
  });
});

describe("VoxelWorld recorder", () => {
  it("reports each changed cell with its layer and packed values", () => {
    const world = new VoxelWorld(4);
    world.addLayer(kLayer);
    const recorded: VoxelCellChange[][] = [];
    world.recorder = {
      record: (changes) => recorded.push(changes)
    };

    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });
    world.removeVoxel(kLayer, { position: kOrigin });

    assert.deepEqual(recorded, [
      [{ layerName: kLayer, position: kOrigin, before: -1, after: 256 }],
      [{ layerName: kLayer, position: kOrigin, before: 256, after: -1 }]
    ]);
  });
});

describe("VoxelEngine history", () => {
  it("is disabled unless enabled in the options", () => {
    assert.equal(makeEngine().history.enabled, false);
    assert.equal(
      makeEngine({ history: { enabled: true } }).history.enabled,
      true
    );
  });

  it("clears on load", () => {
    const engine = makeEngine({
      layers: [kLayer],
      history: { enabled: true }
    });
    engine.world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });
    const data = engine.save();

    engine.load(data);

    assert.equal(engine.history.canUndo, false);
  });

  it("forwards undone edits as local commands", () => {
    const engine = makeEngine({
      layers: [kLayer],
      history: { enabled: true }
    });
    engine.world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });
    const origins: string[] = [];
    engine.on("command", (_command, context) => origins.push(context.origin));

    engine.history.undo();

    assert.deepEqual(origins, ["local"]);
  });
});
