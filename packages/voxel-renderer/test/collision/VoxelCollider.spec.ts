// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelEngine } from "../../src/VoxelEngine.ts";
import type {
  VoxelCollider,
  VoxelChunkCollision,
  VoxelColliderContext
} from "../../src/collision/VoxelCollider.ts";

// CONSTANTS
const kCubeId = 1;

// No physics backend here on purpose: importing a Rapier symbol would defeat
// the point of these tests.
function makeFakeCollider() {
  const rebuilt: { key: string; collision: VoxelChunkCollision; }[] = [];
  const removed: string[] = [];
  let disposeCalls = 0;

  const collider: VoxelCollider = {
    rebuildChunk(key, collision) {
      rebuilt.push({ key, collision });
    },
    removeChunk(key) {
      removed.push(key);
    },
    dispose() {
      disposeCalls++;
    }
  };

  return {
    collider,
    rebuilt,
    removed,
    get disposeCalls() {
      return disposeCalls;
    }
  };
}

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

function makeEngine(
  collider?: (context: VoxelColliderContext) => VoxelCollider
) {
  const engine = new VoxelEngine({
    chunkSize: 4,
    layers: ["Ground"],
    blocks: [
      {
        id: kCubeId,
        name: "Cube",
        shapeId: "cube",
        faceTextures: {},
        defaultTexture: { col: 0, row: 0, tilesetId: "atlas" },
        collidable: true
      }
    ],
    collider
  });
  engine.loadTileset(
    { id: "atlas", src: "/atlas.png", tileSize: 16, cols: 4, rows: 4 },
    mockTexture()
  );

  return engine;
}

describe("VoxelEngine — collider wiring", () => {
  it("never calls the factory when no collider option is given", () => {
    const engine = makeEngine();
    engine.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });

    assert.doesNotThrow(() => {
      engine.init();
      engine.tick(0);
      engine.dispose();
    });
  });

  it("invokes the factory once with the engine's registries", () => {
    const contexts: VoxelColliderContext[] = [];
    const fake = makeFakeCollider();

    const engine = makeEngine((context) => {
      contexts.push(context);

      return fake.collider;
    });

    assert.equal(contexts.length, 1);
    assert.equal(contexts[0].blockRegistry, engine.blockRegistry);
    assert.equal(contexts[0].shapeRegistry, engine.shapeRegistry);
  });

  it("rebuilds collision for a dirty chunk with the layer offset", () => {
    const fake = makeFakeCollider();
    const engine = makeEngine(() => fake.collider);

    engine.setLayerOffset("Ground", { x: 8, y: 0, z: 4 });
    // Placed at the offset origin, so it lands in the layer-local chunk 0,0,0.
    engine.setVoxel("Ground", { position: { x: 8, y: 0, z: 4 }, blockId: kCubeId });
    engine.tick(0);

    assert.equal(fake.rebuilt.length, 1);

    const [{ key, collision }] = fake.rebuilt;
    assert.match(key, /:0,0,0$/, "key should identify layer + chunk coords");
    assert.deepEqual(collision.layerOffset, { x: 8, y: 0, z: 4 });
    assert.ok(collision.geometries.size > 0, "expected at least one geometry");
  });

  it("removes collision when a layer is hidden, without rebuilding it", () => {
    const fake = makeFakeCollider();
    const engine = makeEngine(() => fake.collider);

    engine.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });
    engine.tick(0);

    const rebuiltWhileVisible = fake.rebuilt.length;

    engine.updateLayer("Ground", { visible: false });
    engine.markAllChunksDirty();
    engine.tick(0);

    assert.equal(
      fake.rebuilt.length,
      rebuiltWhileVisible,
      "a hidden layer must not rebuild collision"
    );
    assert.ok(fake.removed.length > 0, "expected the chunk collision to be removed");
  });

  it("removes collision for a chunk emptied of every voxel", () => {
    const fake = makeFakeCollider();
    const engine = makeEngine(() => fake.collider);

    engine.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });
    engine.tick(0);

    const [{ key }] = fake.rebuilt;

    engine.removeVoxel("Ground", { position: { x: 0, y: 0, z: 0 } });
    engine.tick(0);

    assert.ok(
      fake.removed.includes(key),
      "the emptied chunk's collision must be released"
    );
  });

  it("disposes the collider along with the engine", () => {
    const fake = makeFakeCollider();
    const engine = makeEngine(() => fake.collider);

    engine.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: kCubeId });
    engine.tick(0);
    engine.dispose();

    assert.equal(fake.disposeCalls, 1);
  });
});
