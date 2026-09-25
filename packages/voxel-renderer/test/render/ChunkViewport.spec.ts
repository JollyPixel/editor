// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ChunkViewport } from "../../src/render/index.ts";
import { ViewDistance } from "../../src/world/index.ts";

// CONSTANTS
const kChunkSize = 4;

function originOf(
  cx: number,
  offset = { x: 0, y: 0, z: 0 }
): { x: number; y: number; z: number; } {
  return {
    x: (cx * kChunkSize) + offset.x,
    y: offset.y,
    z: offset.z
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
    assert.equal(makeViewport(null).contains(originOf(100), false), true);
  });
});

describe("ChunkViewport — contains", () => {
  it("admits a chunk inside the radius", () => {
    const viewport = makeViewport(
      { x: 2, y: 2, z: 2 },
      new ViewDistance({ chunks: 1, hysteresis: 0 })
    );

    assert.equal(viewport.contains(originOf(0), false), true);
  });

  it("rejects a chunk beyond the radius", () => {
    const viewport = makeViewport(
      { x: 2, y: 2, z: 2 },
      new ViewDistance({ chunks: 1, hysteresis: 0 })
    );

    assert.equal(viewport.contains(originOf(4), false), false);
  });

  it("keeps a chunk already in view within the hysteresis slack", () => {
    const origin = originOf(2);
    const viewport = makeViewport(
      { x: 2, y: 2, z: 2 },
      new ViewDistance({ chunks: 1, hysteresis: 1 })
    );

    assert.equal(viewport.contains(origin, false), false);
    assert.equal(viewport.contains(origin, true), true);
  });

  it("measures from the center of the chunk at the given origin", () => {
    const viewport = makeViewport(
      { x: 2, y: 2, z: 2 },
      new ViewDistance({ chunks: 1, hysteresis: 0 })
    );

    assert.equal(viewport.contains(originOf(0), false), true);
    assert.equal(viewport.contains(originOf(0, { x: 40, y: 0, z: 0 }), false), false);
  });
});

describe("ChunkViewport — distanceSquaredTo", () => {
  it("orders chunks by their distance to the focus", () => {
    const viewport = makeViewport({ x: 2, y: 2, z: 2 });

    assert.ok(
      viewport.distanceSquaredTo(originOf(0)) <
        viewport.distanceSquaredTo(originOf(3))
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
