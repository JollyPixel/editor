// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ChunkRebuildQueue, ChunkViewport } from "../../src/render/index.ts";
import {
  ViewDistance,
  type VoxelChunk,
  VoxelLayer
} from "../../src/world/index.ts";

// CONSTANTS
const kChunkSize = 4;

function makeLayer(): VoxelLayer {
  return new VoxelLayer({
    id: "layer_0",
    name: "Ground",
    order: 0,
    chunkSize: kChunkSize
  });
}

function chunkAt(
  layer: VoxelLayer,
  cx: number
): VoxelChunk {
  layer.setVoxelAt(
    { x: cx * kChunkSize, y: 0, z: 0 },
    { blockId: 1, transform: 0 }
  );

  return layer.getChunk(cx, 0, 0)!;
}

function makeViewport(
  focus: { x: number; y: number; z: number; } | null
): ChunkViewport {
  return new ChunkViewport({
    focus,
    viewDistance: ViewDistance.Unlimited,
    policy: "hide",
    chunkSize: kChunkSize
  });
}

function drainAll(
  queue: ChunkRebuildQueue
): VoxelChunk[] {
  const rebuilt: VoxelChunk[] = [];
  queue.drain(0, (_layer, chunk) => rebuilt.push(chunk));

  return rebuilt;
}

describe("ChunkRebuildQueue — push", () => {
  it("queues a chunk once", () => {
    const queue = new ChunkRebuildQueue();
    const layer = makeLayer();
    const chunk = chunkAt(layer, 0);

    assert.equal(queue.push(layer, chunk), true);
    assert.equal(queue.push(layer, chunk), false);
    assert.equal(queue.size, 1);
  });
});

describe("ChunkRebuildQueue — cancel", () => {
  it("skips a cancelled chunk without rebuilding it", () => {
    const queue = new ChunkRebuildQueue();
    const layer = makeLayer();
    const kept = chunkAt(layer, 0);
    const dropped = chunkAt(layer, 1);

    queue.push(layer, kept);
    queue.push(layer, dropped);
    queue.cancel(dropped);

    assert.deepEqual(drainAll(queue), [kept]);
  });
});

describe("ChunkRebuildQueue — drain", () => {
  it("empties the queue when the budget is disabled", () => {
    const queue = new ChunkRebuildQueue();
    const layer = makeLayer();
    for (let cx = 0; cx < 5; cx++) {
      queue.push(layer, chunkAt(layer, cx));
    }

    assert.equal(drainAll(queue).length, 5);
    assert.equal(queue.size, 0);
  });

  it("rebuilds at least one chunk even with an exhausted budget", () => {
    const queue = new ChunkRebuildQueue();
    const layer = makeLayer();
    queue.push(layer, chunkAt(layer, 0));
    queue.push(layer, chunkAt(layer, 1));

    let rebuilt = 0;
    queue.drain(Number.MIN_VALUE, () => {
      rebuilt++;
    });

    assert.equal(rebuilt, 1);
    assert.equal(queue.size, 1);
  });

  it("resumes where the previous drain stopped", () => {
    const queue = new ChunkRebuildQueue();
    const layer = makeLayer();
    const first = chunkAt(layer, 0);
    const second = chunkAt(layer, 1);
    queue.push(layer, first);
    queue.push(layer, second);

    queue.drain(Number.MIN_VALUE, () => void 0);

    assert.deepEqual(drainAll(queue), [second]);
  });

  it("does nothing on an empty queue", () => {
    const queue = new ChunkRebuildQueue();
    assert.deepEqual(drainAll(queue), []);
  });
});

describe("ChunkRebuildQueue — sortBy", () => {
  it("drains chunks nearest the focus first", () => {
    const queue = new ChunkRebuildQueue();
    const layer = makeLayer();
    const far = chunkAt(layer, 4);
    const near = chunkAt(layer, 0);
    queue.push(layer, far);
    queue.push(layer, near);

    queue.sortBy(makeViewport({ x: 2, y: 2, z: 2 }));

    assert.deepEqual(drainAll(queue), [near, far]);
  });
});

describe("ChunkRebuildQueue — focusMovedSinceSort", () => {
  it("reports a move before any sort happened", () => {
    const queue = new ChunkRebuildQueue();
    assert.equal(
      queue.focusMovedSinceSort(makeViewport({ x: 0, y: 0, z: 0 })),
      true
    );
  });

  it("ignores drift below half a chunk since the last sort", () => {
    const queue = new ChunkRebuildQueue();
    queue.sortBy(makeViewport({ x: 0, y: 0, z: 0 }));

    assert.equal(
      queue.focusMovedSinceSort(makeViewport({ x: 1, y: 0, z: 0 })),
      false
    );
    assert.equal(
      queue.focusMovedSinceSort(makeViewport({ x: 2, y: 0, z: 0 })),
      true
    );
  });

  it("forgets the last sort focus once cleared", () => {
    const queue = new ChunkRebuildQueue();
    queue.sortBy(makeViewport({ x: 0, y: 0, z: 0 }));
    queue.clear();

    assert.equal(
      queue.focusMovedSinceSort(makeViewport({ x: 0, y: 0, z: 0 })),
      true
    );
  });
});
