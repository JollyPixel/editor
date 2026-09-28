// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { VoxelView } from "../../src/view/VoxelView.ts";
import type { VoxelColliderContext } from "../../src/view/collision/index.ts";
import {
  makeFakeCollider,
  type FakeCollider
} from "../helpers/fakes.ts";
import {
  makeView,
  placeCube
} from "../helpers/view.ts";

function makeCollidingView(): { view: VoxelView; fake: FakeCollider; } {
  const fake = makeFakeCollider();
  const view = makeView({ layers: ["Ground"], collider: () => fake.collider });

  return { view, fake };
}

describe("VoxelView - collider wiring", () => {
  it("invokes the factory once with the view's registries", () => {
    const contexts: VoxelColliderContext[] = [];
    const fake = makeFakeCollider();

    const view = makeView({
      layers: ["Ground"],
      collider: (context) => {
        contexts.push(context);

        return fake.collider;
      }
    });

    assert.equal(contexts.length, 1);
    assert.equal(contexts[0].blockRegistry, view.document.blocks);
    assert.equal(contexts[0].shapeRegistry, view.shapes);
  });

  it("rebuilds collision for a dirty chunk at its world origin", () => {
    const { view, fake } = makeCollidingView();
    view.document.world.setLayerPosition("Ground", { x: 8, y: 0, z: 4 });
    placeCube(view, "Ground", { x: 8, y: 0, z: 4 });

    view.tick(0);

    assert.equal(fake.rebuilt.length, 1);
    const [[key, collision]] = fake.rebuilt;
    assert.equal(key, "cell:2,0,1");
    assert.deepEqual(collision.origin, { x: 8, y: 0, z: 4 });
    assert.equal(collision.chunks.length, 1);
    assert.ok(collision.geometries.size > 0);
  });

  it("hands one collision with every composited layer chunk of a cell", () => {
    const { view, fake } = makeCollidingView();
    view.document.world.addLayer("Top", { compositing: "replace" });
    placeCube(view, "Ground", { x: 0, y: 0, z: 0 });
    placeCube(view, "Top", { x: 0, y: 0, z: 0 });

    view.tick(0);

    assert.equal(fake.rebuilt.length, 1);
    const [[key, collision]] = fake.rebuilt;
    assert.equal(key, "cell:0,0,0");
    assert.deepEqual(collision.chunks, [
      view.document.world.getLayer("Top")!.getChunk(0, 0, 0),
      view.document.world.getLayer("Ground")!.getChunk(0, 0, 0)
    ]);
  });

  it("rebuilds collision for a chunk that draws no face", () => {
    const { view, fake } = makeCollidingView();
    view.document.world.addLayer("Top", { compositing: "replace" });
    view.document.world.setLayerPosition("Ground", { x: 1, y: 0, z: 0 });
    placeCube(view, "Ground", { x: 1, y: 0, z: 0 });
    placeCube(view, "Top", { x: 1, y: 0, z: 0 });

    view.flush();

    const groundId = view.document.world.getLayer("Ground")!.id;
    const ground = fake.rebuilt.find(([key]) => key === `layer:${groundId}:0,0,0`);
    assert.ok(ground);
    assert.equal(ground[1].geometries.size, 0);
    assert.ok(fake.live.has(ground[0]));
  });

  it("hands colliders vertices relative to the chunk origin", () => {
    const { view, fake } = makeCollidingView();
    view.document.world.getLayer("Ground")!.position = { x: 1, y: 2, z: 3 };
    placeCube(view, "Ground", { x: 10, y: 2, z: 3 });

    view.flush();

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
    const { view, fake } = makeCollidingView();
    placeCube(view, "Ground", { x: 0, y: 0, z: 0 });
    view.tick(0);
    const rebuiltWhileVisible = fake.rebuilt.length;

    view.document.world.updateLayer("Ground", { visible: false });
    view.markAllChunksDirty();
    view.tick(0);

    assert.equal(fake.rebuilt.length, rebuiltWhileVisible);
    assert.equal(fake.live.size, 0);
  });

  it("removes collision for a chunk emptied of every voxel", () => {
    const { view, fake } = makeCollidingView();
    placeCube(view, "Ground", { x: 0, y: 0, z: 0 });
    view.tick(0);

    view.document.world.removeVoxel("Ground", { position: { x: 0, y: 0, z: 0 } });
    view.tick(0);

    assert.equal(fake.live.size, 0);
  });

  it("disposes the collider along with the view", () => {
    const { view, fake } = makeCollidingView();
    placeCube(view, "Ground", { x: 0, y: 0, z: 0 });
    view.tick(0);

    view.dispose();

    assert.equal(fake.disposeCalls, 1);
  });
});
