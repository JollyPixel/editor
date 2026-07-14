// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelEngine } from "../src/VoxelEngine.ts";
import type { VoxelLayerHookEvent } from "../src/hooks.ts";

// CONSTANTS
const kCubeId = 1;
const kDefaultTexture = { col: 0, row: 0 };

/**
 * Minimal mock texture; registerTexture() assigns magFilter/etc then reads
 * image.width / image.height only when cols/rows are omitted from the def.
 * By supplying explicit cols + rows we avoid any DOM image dependency.
 */
function mockTexture(): any {
  return {
    magFilter: 0,
    minFilter: 0,
    colorSpace: "",
    generateMipmaps: true,
    image: { width: 64, height: 64 },
    dispose() {
      // no-op
    }
  };
}

function makeEngine(onLayerUpdated?: (event: VoxelLayerHookEvent) => void) {
  return new VoxelEngine({
    chunkSize: 4,
    blocks: [
      { id: kCubeId, name: "Cube", shapeId: "cube", faceTextures: {}, defaultTexture: kDefaultTexture, collidable: true }
    ],
    onLayerUpdated
  });
}

function registerTileset(engine: VoxelEngine): void {
  engine.loadTileset(
    { id: "atlas", src: "/atlas.png", tileSize: 16, cols: 4, rows: 4 },
    mockTexture()
  );
}

describe("VoxelEngine — construction", () => {
  it("creates layers passed via options", () => {
    const engine = new VoxelEngine({ layers: ["Ground"] });

    assert.ok(engine.getLayer("Ground"));
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

    engine.addLayer("Ground");

    assert.equal(events.length, 1);
    assert.equal(events[0].action, "added");
    assert.equal(events[0].layerName, "Ground");
  });

  it("emits a 'voxel-set' event when a voxel is placed", () => {
    const events: VoxelLayerHookEvent[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.addLayer("Ground");

    engine.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });

    const last = events.at(-1)!;
    assert.equal(last.action, "voxel-set");
    assert.equal(last.layerName, "Ground");
  });

  it("emits a 'voxel-removed' event when a voxel is removed", () => {
    const events: VoxelLayerHookEvent[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.addLayer("Ground");
    engine.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });

    engine.removeVoxel("Ground", { position: { x: 0, y: 0, z: 0 } });

    const last = events.at(-1)!;
    assert.equal(last.action, "voxel-removed");
  });

  it("emits a 'reordered' event when a layer is moved", () => {
    const events: VoxelLayerHookEvent[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.addLayer("A");
    engine.addLayer("B");

    engine.moveLayer("A", "up");

    const last = events.at(-1)!;
    assert.equal(last.action, "reordered");
    assert.equal(last.layerName, "A");
  });

  it("emits an 'object-added' event when an object is added to an object layer", () => {
    const events: VoxelLayerHookEvent[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.addObjectLayer("Objects");

    engine.addObject("Objects", { id: "o1", name: "Thing", x: 0, y: 0, z: 0, visible: true });

    const last = events.at(-1)!;
    assert.equal(last.action, "object-added");
    assert.equal(last.layerName, "Objects");
  });
});

describe("VoxelEngine — layer/voxel mutation delegation", () => {
  it("setVoxel/getVoxel round-trip through world", () => {
    const engine = makeEngine();
    engine.addLayer("Ground");

    engine.setVoxel("Ground", { position: { x: 1, y: 2, z: 3 }, blockId: kCubeId });

    const entry = engine.getVoxel("Ground", { x: 1, y: 2, z: 3 });
    assert.equal(entry?.blockId, kCubeId);
  });

  it("setVoxelBulk places every entry and fires a single 'voxels-set' event", () => {
    const events: VoxelLayerHookEvent[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.addLayer("Ground");

    engine.setVoxelBulk("Ground", [
      { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId },
      { position: { x: 1, y: 0, z: 0 }, blockId: kCubeId }
    ]);

    assert.equal(engine.getVoxel("Ground", { x: 0, y: 0, z: 0 })?.blockId, kCubeId);
    assert.equal(engine.getVoxel("Ground", { x: 1, y: 0, z: 0 })?.blockId, kCubeId);
    const last = events.at(-1)!;
    assert.equal(last.action, "voxels-set");
  });

  it("removeLayer removes it from the world", () => {
    const engine = makeEngine();
    engine.addLayer("Ground");

    const result = engine.removeLayer("Ground");

    assert.equal(result, true);
    assert.equal(engine.getLayer("Ground"), undefined);
  });
});

describe("VoxelEngine — applyRemoteCommand echo-suppression", () => {
  it("applies a voxel-set command to the world without re-emitting the hook", () => {
    const events: VoxelLayerHookEvent[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.addLayer("Ground");
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

    assert.equal(engine.getVoxel("Ground", { x: 5, y: 0, z: 5 })?.blockId, kCubeId);
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

    assert.ok(engine.getLayer("Remote"));
    assert.equal(events.length, 0);
  });

  it("applies a 'reordered' command without re-emitting the hook", () => {
    const events: VoxelLayerHookEvent[] = [];
    const engine = makeEngine((e) => events.push(e));
    engine.addLayer("A");
    engine.addLayer("B");
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
    engine.addLayer("Ground");
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

    engine.setVoxel("Ground", { position: { x: 1, y: 0, z: 0 }, blockId: kCubeId });
    assert.equal(events.length, 1);
    assert.equal(events[0].action, "voxel-set");
  });
});

describe("VoxelEngine — chunk rebuild orchestration", () => {
  it("tick() builds a mesh for a dirty chunk and adds it to root", () => {
    const engine = makeEngine();
    registerTileset(engine);
    engine.addLayer("Ground");
    engine.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });

    engine.tick(0);

    assert.equal(engine.root.children.length, 1);
  });

  it("tick() does not rebuild a chunk that isn't dirty", () => {
    const engine = makeEngine();
    registerTileset(engine);
    engine.addLayer("Ground");
    engine.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });
    engine.tick(0);
    const meshCountAfterFirstTick = engine.root.children.length;

    engine.tick(0);

    assert.equal(engine.root.children.length, meshCountAfterFirstTick);
  });

  it("init() rebuilds meshes for voxels already present before initialization (e.g. after deserialize)", () => {
    const engine = makeEngine();
    registerTileset(engine);
    engine.addLayer("Ground");
    engine.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });

    engine.init();

    assert.equal(engine.root.children.length, 1);
  });

  it("dispose() removes all chunk meshes from root", () => {
    const engine = makeEngine();
    registerTileset(engine);
    engine.addLayer("Ground");
    engine.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });
    engine.tick(0);
    assert.equal(engine.root.children.length, 1);

    engine.dispose();

    assert.equal(engine.root.children.length, 0);
  });
});
