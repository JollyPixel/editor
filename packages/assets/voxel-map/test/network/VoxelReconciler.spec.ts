// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  isVoxelWorldCommand,
  VoxelDocument
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { VoxelReconciler } from "../../src/network/VoxelReconciler.ts";
import type { VoxelMapNetworkCommand } from "../../src/network/types.ts";

// CONSTANTS
const kOrigin = {
  x: 0,
  y: 0,
  z: 0
};

function setup() {
  const document = new VoxelDocument({
    chunkSize: 16,
    layers: ["L3", "L2", "L1"],
    history: { enabled: true }
  });
  const reconciler = new VoxelReconciler(document);
  const pending: VoxelMapNetworkCommand[] = [];
  document.on("command", (command, { origin }) => {
    if (origin === "local" && isVoxelWorldCommand(command)) {
      const stamped = {
        ...command,
        clientId: "A",
        seq: pending.length + 1,
        timestamp: 0
      };
      pending.push(stamped);
      reconciler.capture(stamped);
    }
    reconciler.observe();
  });

  return {
    document,
    reconciler,
    pending
  };
}

function names(
  document: VoxelDocument
): string[] {
  return document.world.getLayers().map((layer) => layer.name);
}

describe("VoxelReconciler", () => {
  test("reverts a pending undo from the cells it changed", () => {
    const { document, reconciler, pending } = setup();

    document.world.setVoxel("L1", { position: kOrigin, blockId: 2 });
    document.history.undo();

    assert.strictEqual(pending.length, 2);
    assert.strictEqual(reconciler.revert([pending[1]]), true);
    assert.strictEqual(document.world.getVoxelAt(kOrigin)?.blockId, 2);
    assert.strictEqual(reconciler.revert([pending[0]]), true);
    assert.strictEqual(document.world.getVoxelAt(kOrigin), undefined);
  });

  test("reverts layer moves to the order before them", () => {
    const { document, reconciler, pending } = setup();
    const before = names(document);

    document.world.moveLayerTo("L3", 0);
    document.world.moveLayer("L2", "up");

    assert.strictEqual(reconciler.revert(pending), true);
    assert.deepStrictEqual(names(document), before);
  });

  test("reverts a new layer by removing it", () => {
    const { document, reconciler, pending } = setup();

    document.world.addLayer("L4");

    assert.strictEqual(reconciler.revert(pending), true);
    assert.strictEqual(document.world.getLayer("L4"), undefined);
  });

  test("reverts a rename and a visibility change to the previous values", () => {
    const { document, reconciler, pending } = setup();
    const layer = document.world.getLayer("L1")!;

    document.world.updateLayer("L1", { name: "Floor", visible: false });

    assert.strictEqual(reconciler.revert(pending), true);
    assert.strictEqual(layer.name, "L1");
    assert.strictEqual(layer.visible, true);
  });

  test("reverts a layer position and a clone", () => {
    const { document, reconciler, pending } = setup();
    const layer = document.world.getLayer("L1")!;

    document.world.setLayerPosition("L1", { x: 4, y: 0, z: 0 });
    document.world.cloneLayer("L1");

    assert.strictEqual(reconciler.revert(pending), true);
    assert.deepStrictEqual(layer.position, kOrigin);
    assert.deepStrictEqual(names(document), ["L1", "L2", "L3"]);
  });

  test("refuses to revert a command it has no inverse for", () => {
    const { document, reconciler, pending } = setup();

    document.world.removeLayer("L1");

    assert.strictEqual(reconciler.revert(pending), false);
    assert.strictEqual(document.world.getLayer("L1"), undefined);
  });

  test("a replay captures the cells it overwrites", () => {
    const { document, reconciler } = setup();
    document.world.setVoxel("L1", { position: kOrigin, blockId: 5 });
    const replayed: VoxelMapNetworkCommand = {
      action: "voxel-set",
      layerId: document.world.getLayer("L1")!.id,
      metadata: {
        position: kOrigin,
        blockId: 7,
        rotation: 0,
        flipX: false,
        flipY: false,
        flipZ: false
      },
      clientId: "A",
      seq: 9,
      timestamp: 0
    };

    assert.strictEqual(reconciler.replay(replayed), true);
    assert.strictEqual(document.world.getVoxelAt(kOrigin)?.blockId, 7);
    assert.strictEqual(reconciler.revert([replayed]), true);
    assert.strictEqual(document.world.getVoxelAt(kOrigin)?.blockId, 5);
  });

  test("a replay on a missing layer is rejected", () => {
    const { reconciler } = setup();

    assert.strictEqual(reconciler.replay({
      action: "voxel-removed",
      layerId: "missing",
      metadata: { position: kOrigin },
      clientId: "A",
      seq: 1,
      timestamp: 0
    }), false);
  });
});
