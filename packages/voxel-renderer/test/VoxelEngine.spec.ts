// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { VoxelEngine } from "../src/VoxelEngine.ts";
import type {
  VoxelBlockHookEvent,
  VoxelLayerHookEvent
} from "../src/hooks.ts";
import { mockTexture } from "./helpers/mockTexture.ts";
import { makeBlockDef } from "./helpers/blocks.ts";

// CONSTANTS
const kCubeId = 1;
const kLeavesId = 2;
const kDefaultTexture = { col: 0, row: 0 };

/** The material variants VoxelEngine's chunk meshes are built with. */
type ChunkMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial | THREE.MeshStandardMaterial>;

function makeEngine(onLayerUpdated?: (event: VoxelLayerHookEvent) => void) {
  return new VoxelEngine({
    chunkSize: 4,
    blocks: [
      makeBlockDef(kCubeId, "cube", { name: "Cube" })
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

describe("VoxelEngine — chunk rebuild orchestration", () => {
  it("tick() builds a mesh for a dirty chunk and adds it to root", () => {
    const engine = makeEngine();
    registerTileset(engine);
    engine.world.addLayer("Ground");
    engine.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });

    engine.tick(0);

    assert.equal(engine.root.children.length, 1);
  });

  it("tick() does not rebuild a chunk that isn't dirty", () => {
    const engine = makeEngine();
    registerTileset(engine);
    engine.world.addLayer("Ground");
    engine.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });
    engine.tick(0);
    const meshCountAfterFirstTick = engine.root.children.length;

    engine.tick(0);

    assert.equal(engine.root.children.length, meshCountAfterFirstTick);
  });

  it("init() rebuilds meshes for voxels already present before initialization (e.g. after deserialize)", () => {
    const engine = makeEngine();
    registerTileset(engine);
    engine.world.addLayer("Ground");
    engine.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });

    engine.init();

    assert.equal(engine.root.children.length, 1);
  });

  it("dispose() removes all chunk meshes from root", () => {
    const engine = makeEngine();
    registerTileset(engine);
    engine.world.addLayer("Ground");
    engine.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });
    engine.tick(0);
    assert.equal(engine.root.children.length, 1);

    engine.dispose();

    assert.equal(engine.root.children.length, 0);
  });
});

/**
 * Fills `layer` with one voxel per chunk across `count` chunks, so a rebuild
 * has more than one unit of work to spread over frames.
 */
function fillChunks(
  engine: VoxelEngine,
  layerName: string,
  count: number
): void {
  for (let i = 0; i < count; i++) {
    engine.world.setVoxel(layerName, { position: { x: i * 4, y: 0, z: 0 }, blockId: kCubeId });
  }
}

describe("VoxelEngine — budgeted rebuild queue", () => {
  it("rebuilds every dirty chunk in one tick when the budget is disabled", () => {
    const engine = new VoxelEngine({ chunkSize: 4, rebuildBudgetMs: 0, blocks: [
      makeBlockDef(kCubeId, "cube", { name: "Cube" })
    ] });
    registerTileset(engine);
    engine.world.addLayer("Ground");
    fillChunks(engine, "Ground", 6);

    engine.tick(0);

    assert.equal(engine.pendingRebuilds, 0);
    assert.equal(engine.root.children.length, 6);
  });

  it("defers the rest of the queue once the budget is spent", () => {
    // Number.MIN_VALUE is the smallest positive double, so the budget is
    // effectively zero: it's exhausted after the first unit of work, leaving
    // only the first chunk of the queue rebuilt per tick.
    const engine = new VoxelEngine({ chunkSize: 4, rebuildBudgetMs: Number.MIN_VALUE, blocks: [
      makeBlockDef(kCubeId, "cube", { name: "Cube" })
    ] });
    registerTileset(engine);
    engine.world.addLayer("Ground");
    fillChunks(engine, "Ground", 6);

    engine.tick(0);

    assert.equal(engine.root.children.length, 1);
    assert.equal(engine.pendingRebuilds, 5);
  });

  it("drains the deferred queue over subsequent ticks", () => {
    const engine = new VoxelEngine({ chunkSize: 4, rebuildBudgetMs: Number.MIN_VALUE, blocks: [
      makeBlockDef(kCubeId, "cube", { name: "Cube" })
    ] });
    registerTileset(engine);
    engine.world.addLayer("Ground");
    fillChunks(engine, "Ground", 4);

    for (let i = 0; i < 4; i++) {
      engine.tick(0);
    }

    assert.equal(engine.pendingRebuilds, 0);
    assert.equal(engine.root.children.length, 4);
  });

  it("flush() ignores the budget", () => {
    const engine = new VoxelEngine({ chunkSize: 4, rebuildBudgetMs: Number.MIN_VALUE, blocks: [
      makeBlockDef(kCubeId, "cube", { name: "Cube" })
    ] });
    registerTileset(engine);
    engine.world.addLayer("Ground");
    fillChunks(engine, "Ground", 6);

    engine.flush();

    assert.equal(engine.pendingRebuilds, 0);
    assert.equal(engine.root.children.length, 6);
  });

  it("keeps an edit that lands after the flag is cleared", () => {
    const engine = makeEngine();
    registerTileset(engine);
    engine.world.addLayer("Ground");
    engine.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });
    engine.tick(0);

    // The chunk was meshed, so a further edit must dirty it again rather than
    // being swallowed by the clear that ran before the mesh.
    engine.world.setVoxel("Ground", { position: { x: 1, y: 0, z: 0 }, blockId: kCubeId });

    assert.equal(engine.world.getLayer("Ground")!.getChunk(0, 0, 0)!.dirty, true);
  });

  it("rebuilds chunks nearest the focus first", () => {
    const engine = new VoxelEngine({ chunkSize: 4, rebuildBudgetMs: Number.MIN_VALUE, blocks: [
      makeBlockDef(kCubeId, "cube", { name: "Cube" })
    ] });
    registerTileset(engine);
    engine.world.addLayer("Ground");
    fillChunks(engine, "Ground", 4);
    engine.focus = { x: 14, y: 2, z: 2 };

    engine.tick(0);

    assert.equal(engine.root.children.length, 1);
    assert.match(engine.root.children[0].name, /:3,0,0:/);
  });

  it("keeps rebuilding away from the focus over several ticks", () => {
    const engine = new VoxelEngine({ chunkSize: 4, rebuildBudgetMs: Number.MIN_VALUE, blocks: [
      makeBlockDef(kCubeId, "cube", { name: "Cube" })
    ] });
    registerTileset(engine);
    engine.world.addLayer("Ground");
    // Chunks are created from the origin outwards, so the focus at the far
    // end must reverse the order they were enqueued in.
    fillChunks(engine, "Ground", 4);
    engine.focus = { x: 14, y: 2, z: 2 };

    for (let tick = 0; tick < 4; tick++) {
      engine.tick(0);
    }

    assert.deepEqual(
      engine.root.children.map((mesh) => mesh.name.split(":")[1]),
      ["3,0,0", "2,0,0", "1,0,0", "0,0,0"]
    );
  });

  it("reorders the queue when the focus moves without new dirty chunks", () => {
    const engine = new VoxelEngine({ chunkSize: 4, rebuildBudgetMs: Number.MIN_VALUE, blocks: [
      makeBlockDef(kCubeId, "cube", { name: "Cube" })
    ] });
    registerTileset(engine);
    engine.world.addLayer("Ground");
    fillChunks(engine, "Ground", 4);
    engine.focus = { x: 14, y: 2, z: 2 };
    engine.tick(0);

    // Nothing dirties a chunk between the two ticks: only the move may
    // promote the chunk at the other end of the queue.
    engine.focus = { x: 2, y: 2, z: 2 };
    engine.tick(0);

    assert.deepEqual(
      engine.root.children.map((mesh) => mesh.name.split(":")[1]),
      ["3,0,0", "0,0,0"]
    );
  });

  it("ignores a focus move smaller than half a chunk", () => {
    const engine = new VoxelEngine({ chunkSize: 4, rebuildBudgetMs: Number.MIN_VALUE, blocks: [
      makeBlockDef(kCubeId, "cube", { name: "Cube" })
    ] });
    registerTileset(engine);
    engine.world.addLayer("Ground");
    fillChunks(engine, "Ground", 4);
    engine.focus = { x: 14, y: 2, z: 2 };
    engine.tick(0);

    engine.focus = { x: 13, y: 2, z: 2 };
    engine.tick(0);

    assert.deepEqual(
      engine.root.children.map((mesh) => mesh.name.split(":")[1]),
      ["3,0,0", "2,0,0"]
    );
  });

  it("builds the whole world from init(), nearest the focus first", () => {
    const engine = new VoxelEngine({ chunkSize: 4, blocks: [
      makeBlockDef(kCubeId, "cube", { name: "Cube" })
    ] });
    registerTileset(engine);
    engine.world.addLayer("Ground");
    fillChunks(engine, "Ground", 4);
    engine.focus = { x: 14, y: 2, z: 2 };

    engine.init();

    assert.deepEqual(
      engine.root.children.map((mesh) => mesh.name.split(":")[1]),
      ["3,0,0", "2,0,0", "1,0,0", "0,0,0"]
    );
    assert.equal(engine.pendingRebuilds, 0);
  });

  it("does not rebuild a chunk unloaded while it was queued", () => {
    const engine = new VoxelEngine({ chunkSize: 4, rebuildBudgetMs: Number.MIN_VALUE, blocks: [
      makeBlockDef(kCubeId, "cube", { name: "Cube" })
    ] });
    registerTileset(engine);
    engine.world.addLayer("Ground");
    fillChunks(engine, "Ground", 3);
    engine.tick(0);
    assert.equal(engine.pendingRebuilds, 2);

    // Emptying a chunk drops it from the layer; the queue must let it go too.
    engine.world.removeVoxel("Ground", { position: { x: 4, y: 0, z: 0 } });
    engine.world.removeVoxel("Ground", { position: { x: 8, y: 0, z: 0 } });
    engine.flush();

    assert.equal(engine.pendingRebuilds, 0);
    assert.equal(engine.root.children.length, 1);
  });
});

describe("VoxelEngine — layer opacity on the material", () => {
  it("renders a fully opaque layer with an opaque material", () => {
    const engine = makeEngine();
    registerTileset(engine);
    engine.world.addLayer("Ground");
    engine.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });
    engine.flush();

    const material = (engine.root.children[0] as ChunkMesh).material;
    assert.equal(material.transparent, false);
    assert.equal(material.opacity, 1);
    assert.equal(material.depthWrite, true);
    // Nothing can be seen through it, so its back faces stay culled.
    assert.equal(material.side, THREE.FrontSide);
  });

  it("carries the layer opacity on the material instead of the geometry", () => {
    const engine = makeEngine();
    registerTileset(engine);
    engine.world.addLayer("Ground", { opacity: 0.5 });
    engine.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });
    engine.flush();

    const mesh = engine.root.children[0] as ChunkMesh;
    assert.equal(mesh.geometry.getAttribute("color"), undefined);
    assert.equal(mesh.material.transparent, true);
    assert.equal(mesh.material.opacity, 0.5);
    assert.equal(mesh.material.depthWrite, true);
    // The mesher emits both faces of a voxel, so a second pass over the same
    // quads would only blend them twice.
    assert.equal(mesh.material.side, THREE.FrontSide);
  });

  it("gives transparent blocks their own double-sided mesh on an opaque layer", () => {
    const engine = new VoxelEngine({
      chunkSize: 4,
      blocks: [
        makeBlockDef(kCubeId, "cube", { name: "Cube" }),
        {
          id: kLeavesId, name: "Leaves", shapeId: "cube", transparent: true,
          faceTextures: {}, defaultTexture: kDefaultTexture, collidable: true
        }
      ]
    });
    registerTileset(engine);
    engine.world.addLayer("Ground");
    engine.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });
    engine.world.setVoxel("Ground", { position: { x: 2, y: 0, z: 0 }, blockId: kLeavesId });
    engine.flush();

    const meshes = engine.root.children as ChunkMesh[];
    const solid = meshes.find((mesh) => !mesh.name.endsWith(":cutout"));
    const cutout = meshes.find((mesh) => mesh.name.endsWith(":cutout"));
    assert.equal(meshes.length, 2);
    assert.ok(solid && cutout);
    // Same texture and render queue, opposite sides: the solid pass keeps its
    // back faces culled, the cutout one shows them through its own holes.
    assert.equal(solid.material.map, cutout.material.map);
    assert.equal(solid.material.transparent, false);
    assert.equal(cutout.material.transparent, false);
    assert.equal(solid.material.side, THREE.FrontSide);
    assert.equal(cutout.material.side, THREE.DoubleSide);
  });

  it("keeps an almost-opaque layer out of the opaque material bucket", () => {
    const engine = makeEngine();
    registerTileset(engine);
    engine.world.addLayer("Ground", { opacity: 0.999 });
    engine.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });
    engine.flush();

    const material = (engine.root.children[0] as ChunkMesh).material;
    assert.equal(material.transparent, true);
    assert.ok(material.opacity < 1);
  });

  it("shares one material between layers whose opacities land in one bucket", () => {
    const engine = makeEngine();
    registerTileset(engine);
    engine.world.addLayer("A", { opacity: 0.5 });
    engine.world.addLayer("B", { opacity: 0.5001 });
    // Distinct positions, otherwise the higher-priority layer wins compositing
    // and the other emits no mesh at all.
    engine.world.setVoxel("A", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });
    engine.world.setVoxel("B", { position: { x: 8, y: 0, z: 0 }, blockId: kCubeId });
    engine.flush();

    const [first, second] = engine.root.children as ChunkMesh[];
    assert.equal(engine.root.children.length, 2);
    assert.equal(first.material, second.material);
  });
});

describe("VoxelEngine — block definitions", () => {
  it("registers a definition, marks the chunks dirty and emits", () => {
    const events: VoxelBlockHookEvent[] = [];
    const engine = makeEngine();
    engine.onBlockUpdated = (event) => events.push(event);
    engine.world.addLayer("Ground");
    engine.world.setVoxelAt("Ground", { x: 0, y: 0, z: 0 }, kCubeId);
    engine.tick();

    engine.defineBlock(makeBlockDef(kLeavesId, "cube", { name: "Leaves" }));

    assert.equal(engine.blockRegistry.get(kLeavesId)?.name, "Leaves");
    assert.deepEqual(
      events.map((event) => event.action),
      ["block-defined"]
    );
    assert.ok(
      [...engine.world.getAllChunks()].every(({ chunk }) => chunk.dirty)
    );
  });

  it("emits the resolved definition, not the raw one", () => {
    const events: VoxelBlockHookEvent[] = [];
    const engine = makeEngine();
    engine.onBlockUpdated = (event) => events.push(event);

    engine.defineBlock(makeBlockDef(kLeavesId, "cube"));

    const [event] = events;
    assert.equal(event.action, "block-defined");
    assert.deepEqual(
      event.action === "block-defined" ? event.block : null,
      engine.blockRegistry.get(kLeavesId)
    );
  });

  it("emits once per block of a batch", () => {
    const events: VoxelBlockHookEvent[] = [];
    const engine = makeEngine();
    engine.onBlockUpdated = (event) => events.push(event);

    engine.defineBlocks([
      makeBlockDef(kLeavesId, "cube"),
      makeBlockDef(3, "cube")
    ]);

    assert.equal(events.length, 2);
  });

  it("emits nothing for an empty batch", () => {
    const events: VoxelBlockHookEvent[] = [];
    const engine = makeEngine();
    engine.onBlockUpdated = (event) => events.push(event);

    engine.defineBlocks([]);

    assert.deepEqual(events, []);
  });

  it("removes a definition and reports the removal", () => {
    const events: VoxelBlockHookEvent[] = [];
    const engine = makeEngine();
    engine.onBlockUpdated = (event) => events.push(event);

    assert.equal(engine.removeBlock(kCubeId), true);

    assert.equal(engine.blockRegistry.has(kCubeId), false);
    assert.deepEqual(
      events.map((event) => event.action),
      ["block-removed"]
    );
  });

  it("stays silent when the removed id is unknown", () => {
    const events: VoxelBlockHookEvent[] = [];
    const engine = makeEngine();
    engine.onBlockUpdated = (event) => events.push(event);

    assert.equal(engine.removeBlock(99), false);

    assert.deepEqual(events, []);
  });
});
