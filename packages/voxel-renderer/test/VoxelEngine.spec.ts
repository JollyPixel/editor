// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelEngine } from "../src/VoxelEngine.ts";
import type { VoxelLayerHookEvent } from "../src/hooks.ts";
import {
  makeEngine as makeBaseEngine,
  CUBE_ID as kCubeId
} from "./helpers/engine.ts";

function makeEngine(
  onLayerUpdated?: (event: VoxelLayerHookEvent) => void
): VoxelEngine {
  return makeBaseEngine({ onLayerUpdated });
}

describe("VoxelEngine — construction", () => {
  it("creates layers passed via options", () => {
    const engine = new VoxelEngine({ layers: ["Ground"] });

    assert.ok(engine.world.getLayer("Ground"));
  });

  it("has an empty root Object3D group with no meshes until tick/init", () => {
    const engine = makeEngine();

    assert.equal(engine.root.children.length, 0);
  });
});

describe("VoxelEngine — hook emission", () => {
  it("emits an 'added' event when a layer is added", () => {
    const events: VoxelLayerHookEvent[] = [];
    const engine = makeEngine((e) => events.push(e));

    engine.world.addLayer("Ground");

    assert.equal(events.length, 1);
    assert.equal(events[0].action, "added");
    assert.equal(events[0].layerName, "Ground");
  });

  it("emits a 'voxel-set' event when a voxel is placed", () => {
    const events: VoxelLayerHookEvent[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.world.addLayer("Ground");

    engine.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });

    const last = events.at(-1)!;
    assert.equal(last.action, "voxel-set");
    assert.equal(last.layerName, "Ground");
  });

  it("emits a 'voxel-removed' event when a voxel is removed", () => {
    const events: VoxelLayerHookEvent[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.world.addLayer("Ground");
    engine.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });

    engine.world.removeVoxel("Ground", { position: { x: 0, y: 0, z: 0 } });

    const last = events.at(-1)!;
    assert.equal(last.action, "voxel-removed");
  });

  it("emits a 'reordered' event when a layer is moved", () => {
    const events: VoxelLayerHookEvent[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.world.addLayer("A");
    engine.world.addLayer("B");

    engine.world.moveLayer("B", "up");

    const last = events.at(-1)!;
    assert.equal(last.action, "reordered");
    assert.equal(last.layerName, "B");
  });

  it("emits nothing when a layer is already at the end of the order", () => {
    const events: VoxelLayerHookEvent[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.world.addLayer("A");
    engine.world.addLayer("B");

    engine.world.moveLayer("A", "up");

    assert.equal(events.at(-1)!.action, "added");
  });

  it("emits an 'object-added' event when an object is added to an object layer", () => {
    const events: VoxelLayerHookEvent[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.world.addObjectLayer("Objects");

    engine.world.addObjectToLayer("Objects", { id: "o1", name: "Thing", x: 0, y: 0, z: 0, visible: true });

    const last = events.at(-1)!;
    assert.equal(last.action, "object-added");
    assert.equal(last.layerName, "Objects");
  });
});

describe("VoxelEngine — layer/voxel mutation delegation", () => {
  it("setVoxel/getVoxel round-trip through world", () => {
    const engine = makeEngine();
    engine.world.addLayer("Ground");

    engine.world.setVoxel("Ground", { position: { x: 1, y: 2, z: 3 }, blockId: kCubeId });

    const entry = engine.world.getLayer("Ground")!.getVoxelAt({ x: 1, y: 2, z: 3 });
    assert.equal(entry?.blockId, kCubeId);
  });

  it("setVoxelBulk places every entry and fires a single 'voxels-set' event", () => {
    const events: VoxelLayerHookEvent[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.world.addLayer("Ground");

    engine.world.setVoxelBulk("Ground", [
      { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId },
      { position: { x: 1, y: 0, z: 0 }, blockId: kCubeId }
    ]);

    assert.equal(engine.world.getLayer("Ground")!.getVoxelAt({ x: 0, y: 0, z: 0 })?.blockId, kCubeId);
    assert.equal(engine.world.getLayer("Ground")!.getVoxelAt({ x: 1, y: 0, z: 0 })?.blockId, kCubeId);
    const last = events.at(-1)!;
    assert.equal(last.action, "voxels-set");
  });

  it("removeLayer removes it from the world", () => {
    const engine = makeEngine();
    engine.world.addLayer("Ground");

    const result = engine.world.removeLayer("Ground");

    assert.equal(result, true);
    assert.equal(engine.world.getLayer("Ground"), undefined);
  });
});

describe("VoxelEngine — applyRemoteCommand echo-suppression", () => {
  it("applies a voxel-set command to the world without re-emitting the hook", () => {
    const events: VoxelLayerHookEvent[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.world.addLayer("Ground");
    events.length = 0;

    engine.applyRemoteCommand({
      action: "voxel-set",
      layerName: "Ground",
      metadata: {
        position: { x: 5, y: 0, z: 5 },
        blockId: kCubeId,
        rotation: 0,
        flipX: false,
        flipZ: false,
        flipY: false
      }
    });

    assert.equal(engine.world.getLayer("Ground")!.getVoxelAt({ x: 5, y: 0, z: 5 })?.blockId, kCubeId);
    assert.equal(events.length, 0);
  });

  it("applies an 'added' command without re-emitting the hook", () => {
    const events: VoxelLayerHookEvent[] = [];
    const engine = makeEngine((e) => events.push(e));

    engine.applyRemoteCommand({
      action: "added",
      layerName: "Remote",
      metadata: { options: {} }
    });

    assert.ok(engine.world.getLayer("Remote"));
    assert.equal(events.length, 0);
  });

  it("applies a 'reordered' command without re-emitting the hook", () => {
    const events: VoxelLayerHookEvent[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.world.addLayer("A");
    engine.world.addLayer("B");
    events.length = 0;

    engine.applyRemoteCommand({
      action: "reordered",
      layerName: "A",
      metadata: { direction: "up" }
    });

    assert.equal(events.length, 0);
  });

  it("still applies local mutations normally after a remote command", () => {
    const events: VoxelLayerHookEvent[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.world.addLayer("Ground");
    events.length = 0;

    engine.applyRemoteCommand({
      action: "voxel-set",
      layerName: "Ground",
      metadata: {
        position: { x: 0, y: 0, z: 0 },
        blockId: kCubeId,
        rotation: 0,
        flipX: false,
        flipZ: false,
        flipY: false
      }
    });
    assert.equal(events.length, 0);

    engine.world.setVoxel("Ground", { position: { x: 1, y: 0, z: 0 }, blockId: kCubeId });
    assert.equal(events.length, 1);
    assert.equal(events[0].action, "voxel-set");
  });
});
