// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ChunkViewport,
  FULL_DETAIL
} from "../../src/render/index.ts";
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

describe("ChunkViewport — detailOf", () => {
  function detailViewport(
    focus: { x: number; y: number; z: number; } | null,
    distances: { farDistance?: number; lodDistance?: number; } = {}
  ): ChunkViewport {
    return new ChunkViewport({
      focus,
      viewDistance: ViewDistance.Unlimited,
      policy: "hide",
      chunkSize: kChunkSize,
      ...distances
    });
  }

  it("keeps full detail without distances", () => {
    const viewport = detailViewport({ x: 2, y: 2, z: 2 });

    assert.equal(viewport.detailed, false);
    assert.equal(viewport.detailOf(originOf(10)), FULL_DETAIL);
  });

  it("keeps full detail without a focus", () => {
    const viewport = detailViewport(null, { farDistance: 1 });

    assert.equal(viewport.detailed, false);
    assert.equal(viewport.detailOf(originOf(10)), FULL_DETAIL);
  });

  it("flags chunks beyond farDistance", () => {
    const viewport = detailViewport({ x: 2, y: 2, z: 2 }, { farDistance: 6 });

    assert.deepEqual(viewport.detailOf(originOf(1)), { far: false, lod: 0 });
    assert.deepEqual(viewport.detailOf(originOf(2)), { far: true, lod: 0 });
  });

  it("meshes chunks beyond lodDistance at the next level", () => {
    const viewport = detailViewport({ x: 2, y: 2, z: 2 }, { lodDistance: 6 });

    assert.deepEqual(viewport.detailOf(originOf(1)), { far: false, lod: 0 });
    assert.deepEqual(viewport.detailOf(originOf(2)), { far: false, lod: 1 });
  });

  it("keeps a reduced chunk until it comes half a chunk closer", () => {
    const viewport = detailViewport({ x: 2, y: 2, z: 2 }, { farDistance: 6 });
    const reduced = { far: true, lod: 0 };
    const nearBorder = originOf(0, { x: 5, y: 0, z: 0 });
    const wellInside = originOf(0, { x: 3, y: 0, z: 0 });

    assert.equal(viewport.detailOf(nearBorder), FULL_DETAIL);
    assert.equal(viewport.detailOf(nearBorder, reduced), reduced);
    assert.deepEqual(viewport.detailOf(wellInside, reduced), FULL_DETAIL);
  });

  it("returns the current detail object when nothing changed", () => {
    const viewport = detailViewport({ x: 2, y: 2, z: 2 }, { farDistance: 6, lodDistance: 6 });
    const current = { far: true, lod: 1 };

    assert.equal(viewport.detailOf(originOf(3), current), current);
  });

  it("differs from a viewport with other detail distances", () => {
    const focus = { x: 2, y: 2, z: 2 };
    const viewport = detailViewport(focus, { farDistance: 6 });

    assert.equal(viewport.differsFrom(detailViewport(focus, { farDistance: 6 })), false);
    assert.equal(viewport.differsFrom(detailViewport(focus, { farDistance: 8 })), true);
    assert.equal(viewport.differsFrom(detailViewport(focus, { farDistance: 6, lodDistance: 8 })), true);
  });
});
