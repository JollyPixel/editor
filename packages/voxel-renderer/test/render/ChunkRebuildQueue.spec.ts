// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ChunkRebuildQueue,
  ChunkViewport,
  type ChunkMeshTarget
} from "../../src/render/index.ts";
import { ViewDistance } from "../../src/world/index.ts";

// CONSTANTS
const kChunkSize = 4;

function targetAt(
  cx: number
): ChunkMeshTarget {
  return {
    key: `cell:${cx},0,0`,
    layer: null,
    cx,
    cy: 0,
    cz: 0,
    origin: { x: cx * kChunkSize, y: 0, z: 0 }
  };
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
): ChunkMeshTarget[] {
  const rebuilt: ChunkMeshTarget[] = [];
  queue.drain(0, (target) => void rebuilt.push(target));

  return rebuilt;
}

describe("ChunkRebuildQueue — push", () => {
  it("queues a target key once", () => {
    const queue = new ChunkRebuildQueue();

    assert.equal(queue.push(targetAt(0)), true);
    assert.equal(queue.push(targetAt(0)), false);
    assert.equal(queue.size, 1);
  });

  it("rebuilds the latest target pushed under a key", () => {
    const queue = new ChunkRebuildQueue();
    const moved = {
      ...targetAt(0),
      origin: { x: 8, y: 0, z: 0 }
    };

    queue.push(targetAt(0));
    queue.push(moved);

    assert.deepEqual(drainAll(queue), [moved]);
  });
});

describe("ChunkRebuildQueue — cancel", () => {
  it("skips a cancelled target without rebuilding it", () => {
    const queue = new ChunkRebuildQueue();
    const kept = targetAt(0);

    queue.push(kept);
    queue.push(targetAt(1));
    queue.cancel(targetAt(1).key);

    assert.deepEqual(drainAll(queue), [kept]);
  });

  it("rebuilds a target pushed again after a cancel once", () => {
    const queue = new ChunkRebuildQueue();

    queue.push(targetAt(0));
    queue.cancel(targetAt(0).key);
    queue.push(targetAt(0));

    assert.equal(drainAll(queue).length, 1);
  });
});

describe("ChunkRebuildQueue — drain", () => {
  it("empties the queue when the budget is disabled", () => {
    const queue = new ChunkRebuildQueue();
    for (let cx = 0; cx < 5; cx++) {
      queue.push(targetAt(cx));
    }

    assert.equal(drainAll(queue).length, 5);
    assert.equal(queue.size, 0);
  });

  it("rebuilds at least one target even with an exhausted budget", () => {
    const queue = new ChunkRebuildQueue();
    queue.push(targetAt(0));
    queue.push(targetAt(1));

    let rebuilt = 0;
    queue.drain(Number.MIN_VALUE, () => {
      rebuilt++;
    });

    assert.equal(rebuilt, 1);
    assert.equal(queue.size, 1);
  });

  it("resumes where the previous drain stopped", () => {
    const queue = new ChunkRebuildQueue();
    const second = targetAt(1);
    queue.push(targetAt(0));
    queue.push(second);

    queue.drain(Number.MIN_VALUE, () => void 0);

    assert.deepEqual(drainAll(queue), [second]);
  });

  it("does nothing on an empty queue", () => {
    const queue = new ChunkRebuildQueue();
    assert.deepEqual(drainAll(queue), []);
  });
});

describe("ChunkRebuildQueue — sortBy", () => {
  it("drains targets nearest the focus first", () => {
    const queue = new ChunkRebuildQueue();
    const far = targetAt(4);
    const near = targetAt(0);
    queue.push(far);
    queue.push(near);

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
