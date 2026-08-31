// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ChunkViewport } from "../../src/render/ChunkViewport.ts";
import { ViewDistance } from "../../src/world/ViewDistance.ts";
import { VoxelLayer } from "../../src/world/VoxelLayer.ts";
import type { VoxelChunk } from "../../src/world/VoxelChunk.ts";

// CONSTANTS
const kChunkSize = 4;

function makeChunk(
  cx: number,
  offset = { x: 0, y: 0, z: 0 }
): { layer: VoxelLayer; chunk: VoxelChunk; } {
  const layer = new VoxelLayer({
    id: "layer_0",
    name: "Ground",
    order: 0,
    chunkSize: kChunkSize,
    offset
  });
  layer.setVoxelAt(
    { x: (cx * kChunkSize) + offset.x, y: offset.y, z: offset.z },
    { blockId: 1, transform: 0 }
  );

  return {
    layer,
    chunk: layer.getChunk(cx, 0, 0)!
  };
}

function makeViewport(
  focus: { x: number; y: number; z: number; } | null,
  viewDistance = ViewDistance.Unlimited
): ChunkViewport {
  return new ChunkViewport({
    focus,
    viewDistance,
    policy: "hide",
    chunkSize: kChunkSize
  });
}

describe("ChunkViewport — unbounded", () => {
  it("is unbounded without a focus", () => {
    assert.equal(makeViewport(null, new ViewDistance({ chunks: 1 })).unbounded, true);
  });

  it("is unbounded with an unlimited view distance", () => {
    assert.equal(makeViewport({ x: 0, y: 0, z: 0 }).unbounded, true);
  });

  it("keeps every chunk while unbounded", () => {
    const { layer, chunk } = makeChunk(100);
    assert.equal(makeViewport(null).contains(layer, chunk, false), true);
  });
});

describe("ChunkViewport — contains", () => {
  it("admits a chunk inside the radius", () => {
    const { layer, chunk } = makeChunk(0);
    const viewport = makeViewport(
      { x: 2, y: 2, z: 2 },
      new ViewDistance({ chunks: 1, hysteresis: 0 })
    );

    assert.equal(viewport.contains(layer, chunk, false), true);
  });

  it("rejects a chunk beyond the radius", () => {
    const { layer, chunk } = makeChunk(4);
    const viewport = makeViewport(
      { x: 2, y: 2, z: 2 },
      new ViewDistance({ chunks: 1, hysteresis: 0 })
    );

    assert.equal(viewport.contains(layer, chunk, false), false);
  });

  it("keeps a chunk already in view within the hysteresis slack", () => {
    const { layer, chunk } = makeChunk(2);
    const viewport = makeViewport(
      { x: 2, y: 2, z: 2 },
      new ViewDistance({ chunks: 1, hysteresis: 1 })
    );

    assert.equal(viewport.contains(layer, chunk, false), false);
    assert.equal(viewport.contains(layer, chunk, true), true);
  });

  it("measures from the chunk center shifted by the layer offset", () => {
    const near = makeChunk(0, { x: 0, y: 0, z: 0 });
    const far = makeChunk(0, { x: 40, y: 0, z: 0 });
    const viewport = makeViewport(
      { x: 2, y: 2, z: 2 },
      new ViewDistance({ chunks: 1, hysteresis: 0 })
    );

    assert.equal(viewport.contains(near.layer, near.chunk, false), true);
    assert.equal(viewport.contains(far.layer, far.chunk, false), false);
  });
});

describe("ChunkViewport — distanceSquaredTo", () => {
  it("orders chunks by their distance to the focus", () => {
    const near = makeChunk(0);
    const far = makeChunk(3);
    const viewport = makeViewport({ x: 2, y: 2, z: 2 });

    assert.ok(
      viewport.distanceSquaredTo(near.layer, near.chunk) <
        viewport.distanceSquaredTo(far.layer, far.chunk)
    );
  });
});

describe("ChunkViewport — focusMovedFrom", () => {
  it("treats a missing previous focus as a move", () => {
    assert.equal(makeViewport({ x: 0, y: 0, z: 0 }).focusMovedFrom(null), true);
  });

  it("ignores drift below half a chunk", () => {
    const viewport = makeViewport({ x: 1, y: 0, z: 0 });
    assert.equal(viewport.focusMovedFrom({ x: 0, y: 0, z: 0 }), false);
  });

  it("reports drift of half a chunk or more on any axis", () => {
    const viewport = makeViewport({ x: 0, y: 0, z: 2 });
    assert.equal(viewport.focusMovedFrom({ x: 0, y: 0, z: 0 }), true);
  });
});

describe("ChunkViewport — differsFrom", () => {
  it("differs from no previous viewport", () => {
    assert.equal(makeViewport({ x: 0, y: 0, z: 0 }).differsFrom(null), true);
  });

  it("differs when the view distance changed", () => {
    const previous = makeViewport({ x: 0, y: 0, z: 0 });
    const next = makeViewport({ x: 0, y: 0, z: 0 }, new ViewDistance({ chunks: 2 }));

    assert.equal(next.differsFrom(previous), true);
  });

  it("differs when the policy changed", () => {
    const previous = makeViewport({ x: 0, y: 0, z: 0 });
    const next = new ChunkViewport({
      focus: { x: 0, y: 0, z: 0 },
      viewDistance: previous.viewDistance,
      policy: "unload",
      chunkSize: kChunkSize
    });

    assert.equal(next.differsFrom(previous), true);
  });

  it("matches an unchanged viewport", () => {
    const previous = makeViewport({ x: 0, y: 0, z: 0 });
    const next = new ChunkViewport({
      focus: { x: 1, y: 0, z: 0 },
      viewDistance: previous.viewDistance,
      policy: previous.policy,
      chunkSize: kChunkSize
    });

    assert.equal(next.differsFrom(previous), false);
  });
});

describe("ChunkViewport — focus copy", () => {
  it("copies the focus so a caller may keep mutating its vector", () => {
    const focus = { x: 0, y: 0, z: 0 };
    const viewport = makeViewport(focus);

    focus.x = 100;

    assert.deepEqual(viewport.focus, { x: 0, y: 0, z: 0 });
  });
});
