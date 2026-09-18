// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  resolvedBlockTextureSlots,
  shapeTextureLayout
} from "../../../src/blocks/shape/index.ts";
import {
  Cube,
  Ramp,
  RampCornerInner,
  Stair
} from "../../../src/blocks/shape/library/index.ts";
import type {
  ResolvedTileRef,
  TileSpan
} from "../../../src/tileset/index.ts";

describe("shapeTextureLayout", () => {
  it("recognizes a cube as six full-tile slots", () => {
    const layout = shapeTextureLayout(new Cube());

    assert.equal(layout.isBox, true);
    assert.deepEqual(
      layout.slots.map((entry) => entry.slot),
      ["front", "back", "left", "right", "top", "bottom"]
    );
    assert.deepEqual(layout.slots[0].bounds, { u0: 0, v0: 0, u1: 1, v1: 1 });
  });

  it("retains a ramp side's triangular corner", () => {
    const layout = shapeTextureLayout(new Ramp());
    const left = layout.slots.find((entry) => entry.slot === "left");

    assert.equal(layout.isBox, false);
    assert.equal(left?.parts[0].corner, "bottom-right");
  });

  it("spans a ramp slope over its true length", () => {
    const layout = shapeTextureLayout(new Ramp());
    const spans = Object.fromEntries(
      layout.slots.map((entry) => [entry.slot, entry.span])
    );

    assert.equal(spans.top.u, 1);
    assert.ok(Math.abs(spans.top.v - Math.SQRT2) < 1e-9);
    assert.deepEqual(spans.front, { u: 1, v: 1 });
    assert.deepEqual(spans.left, { u: 1, v: 1 });
  });

  it("keeps one tile for the sheared facet of an inner ramp corner", () => {
    const layout = shapeTextureLayout(new RampCornerInner());
    const top = layout.slots.find((entry) => entry.slot === "top");

    assert.deepEqual(top?.span, { u: 1, v: 1 });
  });

  it("keeps every polygon contributing to a compound stair slot", () => {
    const layout = shapeTextureLayout(new Stair());
    const left = layout.slots.find((entry) => entry.slot === "left");

    assert.ok((left?.parts.length ?? 0) > 1);
  });

  it("applies a slot override before the block default", () => {
    const slots = resolvedBlockTextureSlots({
      id: 1,
      name: "cube",
      shapeId: "cube",
      collidable: true,
      properties: {},
      defaultTexture: { tilesetId: "atlas", col: 0, row: 0 },
      faceTextures: {
        top: { tilesetId: "atlas", col: 2, row: 1 }
      }
    }, new Cube());

    assert.deepEqual(
      slots.find((entry) => entry.slot === "top")?.tile,
      { tilesetId: "atlas", col: 2, row: 1 }
    );
    assert.deepEqual(
      slots.find((entry) => entry.slot === "front")?.tile,
      { tilesetId: "atlas", col: 0, row: 0 }
    );
  });

  it("spans a ramp slope only when it owns its texture", () => {
    const shared = rampSlopeSpan({});
    const owned = rampSlopeSpan({
      top: { tilesetId: "atlas", col: 1, row: 0 }
    });

    assert.deepEqual(shared, { u: 1, v: 1 });
    assert.ok(Math.abs((owned?.v ?? 0) - Math.SQRT2) < 1e-9);
  });
});

function rampSlopeSpan(
  faceTextures: Record<string, ResolvedTileRef>
): Readonly<TileSpan> | undefined {
  const slots = resolvedBlockTextureSlots({
    id: 1,
    name: "ramp",
    shapeId: "ramp",
    collidable: true,
    properties: {},
    defaultTexture: { tilesetId: "atlas", col: 0, row: 0 },
    faceTextures
  }, new Ramp());

  return slots.find((entry) => entry.slot === "top")?.span;
}
