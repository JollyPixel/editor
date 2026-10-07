// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  CommandHistory,
  type HistoryStepInfo
} from "@jolly-pixel/history";

// Import Internal Dependencies
import { VoxelDocument } from "../../../src/document/VoxelDocument.ts";
import {
  voxelHistoryRegistration,
  type VoxelChange
} from "../../../src/document/history/index.ts";
import {
  isVoxelWorldCommand,
  type VoxelCommand,
  type VoxelCommandContext
} from "../../../src/document/commands/index.ts";
import type {
  VoxelCoord,
  VoxelWorld
} from "../../../src/document/world/index.ts";

// CONSTANTS
const kScope = "map";
const kLayer = "Ground";
const kOrigin = { x: 0, y: 0, z: 0 };
const kNext = { x: 1, y: 0, z: 0 };

interface Emitted {
  command: VoxelCommand;
  context: VoxelCommandContext;
}

function setup() {
  const document = new VoxelDocument({
    chunkSize: 4,
    layers: [kLayer]
  });
  const history = new CommandHistory({ scopes: [kScope] });
  history.register(voxelHistoryRegistration(document, { scope: kScope }));
  const refused: HistoryStepInfo[] = [];
  history.on("refused", (_scope, step) => refused.push(step));
  const emitted: Emitted[] = [];
  document.on("command", (command, context) => emitted.push({ command, context }));

  return {
    document,
    world: document.world,
    layerId: document.world.getLayer(kLayer)!.id,
    history,
    refused,
    emitted
  };
}

function changeOf(
  document: VoxelDocument,
  command: VoxelCommand
): VoxelChange | undefined {
  return isVoxelWorldCommand(command) ? document.edits.changeOf(command) : undefined;
}

function blockAt(
  world: VoxelWorld,
  position: VoxelCoord = kOrigin
): number | undefined {
  return world.getLayer(kLayer)?.getVoxelAt(position)?.blockId;
}

describe("VoxelEdits", () => {
  it("undoes and redoes a world edit, bringing back the previous block and transform", () => {
    const { world, history } = setup();
    world.silently(() => world.setVoxel(kLayer, {
      position: kOrigin,
      blockId: 1,
      rotation: 1,
      flipY: true
    }));

    world.setVoxelBulk(kLayer, [{ position: kOrigin, blockId: 2 }]);
    assert.equal(history.undo(kScope), true);
    assert.deepEqual(world.getLayer(kLayer)?.getVoxelAt(kOrigin), { blockId: 1, transform: 0b10001 });

    assert.equal(history.redo(kScope), true);
    assert.equal(blockAt(world), 2);
  });

  it("brings both shapes of a removed merged cell back", () => {
    const { world, history } = setup();
    world.silently(() => {
      world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });
      world.setVoxel(kLayer, { position: kOrigin, blockId: 2, merge: true });
    });

    world.removeVoxel(kLayer, { position: kOrigin });
    history.undo(kScope);

    assert.equal(world.getLayer(kLayer)?.getVoxelAt(kOrigin)?.partner?.blockId, 2);
  });

  it("files no step for a write that changes nothing or runs unrecorded", () => {
    const { world, history } = setup();

    world.removeVoxel(kLayer, { position: kOrigin });
    world.unrecorded(() => world.setVoxel(kLayer, { position: kOrigin, blockId: 1 }));

    assert.equal(history.state(kScope).canUndo, false);
    assert.equal(blockAt(world), 1);
  });

  it("undoes an open step as one patch per layer", () => {
    const { world, history, emitted } = setup();

    const step = history.open(kScope, "Stroke");
    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });
    world.setVoxel(kLayer, { position: kOrigin, blockId: 2 });
    world.setVoxel(kLayer, { position: kNext, blockId: 3 });
    step.commit();
    emitted.length = 0;
    history.undo(kScope);

    assert.deepEqual(emitted.map(({ command }) => command.action), ["voxels-patched"]);
    assert.deepEqual([blockAt(world), blockAt(world, kNext)], [undefined, undefined]);
  });

  it("sends an undo as a local command whose change carries the step's version", () => {
    const { document, world, history, emitted } = setup();
    document.edits.receipts.attach();

    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });
    document.edits.receipts.confirm(changeOf(document, emitted[0].command)!, 7);
    history.undo(kScope);

    const { command, context } = emitted[1];
    assert.equal(context.origin, "local");
    assert.equal(changeOf(document, command)?.basis, 7);
  });

  it("a peer writing a guarded cell refuses the step and names the peer", () => {
    const { document, world, layerId, refused } = setup();
    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });

    document.apply({
      action: "voxels-patched",
      layerId,
      metadata: { cells: [0, 0, 0, 5, 0] }
    }, { origin: "remote", clientId: "alice" });

    assert.deepEqual(refused, [{ label: "Edit voxels", refused: { reason: "peer", clientId: "alice" } }]);
  });

  it("a peer moving the layer refuses every step on it", () => {
    const { document, world, layerId, history } = setup();
    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });
    world.setVoxel(kLayer, { position: kNext, blockId: 1 });

    document.apply({
      action: "position-updated",
      layerId,
      metadata: { delta: { x: 0, y: 1, z: 0 } }
    }, { origin: "remote", clientId: "alice" });

    assert.equal(history.state(kScope).refused.length, 2);
  });

  it("a replayed pending edit settles the step instead of refusing it", () => {
    const { document, world, layerId, history, refused } = setup();
    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });

    document.apply({
      action: "voxels-patched",
      layerId,
      metadata: { cells: [0, 0, 0, 1, 0] }
    }, { origin: "replay" });

    assert.deepEqual(refused, []);
    assert.equal(history.undo(kScope), true);
    assert.equal(blockAt(world), undefined);
  });

  it("an undo refuses a step whose layer moved under it instead of writing stale cells", () => {
    const { world, history, refused } = setup();
    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });

    world.translateLayer(kLayer, { x: 1, y: 0, z: 0 });

    assert.equal(history.undo(kScope), false);
    assert.deepEqual(refused, [{ label: "Edit voxels", refused: { reason: "changed" } }]);
    assert.equal(blockAt(world, kNext), 1);
  });

  it("a load refuses the steps whose cells it changed", () => {
    const { document, world, history } = setup();
    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });
    const saved = document.save();
    world.setVoxel(kLayer, { position: kNext, blockId: 2 });

    document.load(saved);

    assert.deepEqual(history.state(kScope).refused, [
      { label: "Edit voxels", refused: { reason: "changed" } }
    ]);
    assert.equal(history.undo(kScope), true);
    assert.equal(blockAt(world), undefined);
  });

  it("records the cells an edit replaced only while a history listens", () => {
    const document = new VoxelDocument({ layers: [kLayer] });
    const changes: VoxelChange[] = [];
    document.on("command", (command) => changes.push(changeOf(document, command)!));

    document.world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });
    const unsubscribe = document.edits.subscribe("change", () => undefined);
    document.world.setVoxel(kLayer, { position: kOrigin, blockId: 2 });
    unsubscribe();
    document.world.setVoxel(kLayer, { position: kOrigin, blockId: 3 });

    assert.deepEqual(changes.map(({ inverse }) => inverse.length), [0, 1, 0]);
  });
});
