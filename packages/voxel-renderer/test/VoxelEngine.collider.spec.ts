// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { VoxelEngine } from "../src/VoxelEngine.ts";
import type { VoxelColliderContext } from "../src/collision/index.ts";
import {
  makeFakeCollider,
  type FakeCollider
} from "./helpers/fakes.ts";
import {
  makeEngine,
  placeCube
} from "./helpers/engine.ts";

function makeCollidingEngine(): { engine: VoxelEngine; fake: FakeCollider; } {
  const fake = makeFakeCollider();
  const engine = makeEngine({ layers: ["Ground"], collider: () => fake.collider });

  return { engine, fake };
}

describe("VoxelEngine - collider wiring", () => {
  it("invokes the factory once with the engine's registries", () => {
    const contexts: VoxelColliderContext[] = [];
    const fake = makeFakeCollider();

    const engine = makeEngine({
      layers: ["Ground"],
      collider: (context) => {
        contexts.push(context);

        return fake.collider;
      }
    });

    assert.equal(contexts.length, 1);
    assert.equal(contexts[0].blockRegistry, engine.blockRegistry);
    assert.equal(contexts[0].shapeRegistry, engine.shapeRegistry);
  });

  it("rebuilds collision for a dirty chunk at its world origin", () => {
    const { engine, fake } = makeCollidingEngine();
    engine.world.setLayerPosition("Ground", { x: 8, y: 0, z: 4 });
    placeCube(engine, "Ground", { x: 8, y: 0, z: 4 });

    engine.tick(0);

    assert.equal(fake.rebuilt.length, 1);
    const [[key, collision]] = fake.rebuilt;
    assert.equal(key, "cell:2,0,1");
    assert.deepEqual(collision.origin, { x: 8, y: 0, z: 4 });
    assert.equal(collision.chunks.length, 1);
    assert.ok(collision.geometries.size > 0);
  });

  it("hands one collision with every composited layer chunk of a cell", () => {
    const { engine, fake } = makeCollidingEngine();
    engine.world.addLayer("Top", { compositing: "replace" });
    placeCube(engine, "Ground", { x: 0, y: 0, z: 0 });
    placeCube(engine, "Top", { x: 0, y: 0, z: 0 });

    engine.tick(0);

    assert.equal(fake.rebuilt.length, 1);
    const [[key, collision]] = fake.rebuilt;
    assert.equal(key, "cell:0,0,0");
    assert.deepEqual(collision.chunks, [
      engine.world.getLayer("Top")!.getChunk(0, 0, 0),
      engine.world.getLayer("Ground")!.getChunk(0, 0, 0)
    ]);
  });

  it("rebuilds collision for a chunk that draws no face", () => {
    const { engine, fake } = makeCollidingEngine();
    engine.world.addLayer("Top", { compositing: "replace" });
    engine.world.setLayerPosition("Ground", { x: 1, y: 0, z: 0 });
    placeCube(engine, "Ground", { x: 1, y: 0, z: 0 });
    placeCube(engine, "Top", { x: 1, y: 0, z: 0 });

    engine.tick(0);

    const groundId = engine.world.getLayer("Ground")!.id;
    const ground = fake.rebuilt.find(([key]) => key === `layer:${groundId}:0,0,0`);
    assert.ok(ground);
    assert.equal(ground[1].geometries.size, 0);
    assert.ok(fake.live.has(ground[0]));
  });

  it("hands colliders vertices relative to the chunk origin", () => {
    const { engine, fake } = makeCollidingEngine();
    engine.world.getLayer("Ground")!.position = { x: 1, y: 2, z: 3 };
    placeCube(engine, "Ground", { x: 10, y: 2, z: 3 });

    engine.flush();

    const [[, collision]] = fake.rebuilt;
    const [geometry] = collision.geometries.values();
    const bounds = new THREE.Box3().setFromBufferAttribute(
      geometry.getAttribute("position") as THREE.BufferAttribute
    );
    const [{ cx, cy, cz }] = collision.chunks;
    assert.deepEqual([cx, cy, cz], [2, 0, 0]);
    assert.deepEqual(collision.origin, { x: 9, y: 2, z: 3 });
    assert.equal(bounds.min.x, 1);
    assert.equal(bounds.max.x, 2);
  });

  it("removes collision when a layer is hidden, without rebuilding it", () => {
    const { engine, fake } = makeCollidingEngine();
    placeCube(engine, "Ground", { x: 0, y: 0, z: 0 });
    engine.tick(0);
    const rebuiltWhileVisible = fake.rebuilt.length;

    engine.world.updateLayer("Ground", { visible: false });
    engine.markAllChunksDirty();
    engine.tick(0);

    assert.equal(fake.rebuilt.length, rebuiltWhileVisible);
    assert.equal(fake.live.size, 0);
  });

  it("removes collision for a chunk emptied of every voxel", () => {
    const { engine, fake } = makeCollidingEngine();
    placeCube(engine, "Ground", { x: 0, y: 0, z: 0 });
    engine.tick(0);

    engine.world.removeVoxel("Ground", { position: { x: 0, y: 0, z: 0 } });
    engine.tick(0);

    assert.equal(fake.live.size, 0);
  });

  it("disposes the collider along with the engine", () => {
    const { engine, fake } = makeCollidingEngine();
    placeCube(engine, "Ground", { x: 0, y: 0, z: 0 });
    engine.tick(0);

    engine.dispose();

    assert.equal(fake.disposeCalls, 1);
  });
});
