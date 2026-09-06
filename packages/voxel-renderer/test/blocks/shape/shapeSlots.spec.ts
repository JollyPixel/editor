// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  baseSlotOf,
  shapeSlots,
  slotNameOf,
  type ShapeSlot
} from "../../../src/blocks/shape/shapeSlots.ts";
import {
  Cube,
  Pole,
  PoleY,
  Ramp,
  RampCornerInner,
  RampCornerOuter,
  Slab,
  Stair,
  StairCornerInner,
  StairCornerOuter
} from "../../../src/blocks/shape/library/index.ts";
import type { BlockShape } from "../../../src/blocks/shape/BlockShape.ts";
import { FACE } from "../../../src/utils/math.ts";

function idsOf(
  shape: BlockShape
): string[] {
  return shapeSlots(shape).map((slot) => slot.id);
}

function boundsOf(
  slot: ShapeSlot
): [number, number, number, number] {
  let u0 = Infinity;
  let v0 = Infinity;
  let u1 = -Infinity;
  let v1 = -Infinity;

  for (const definition of slot.definitions) {
    for (const [u, v] of definition.uvs) {
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
    }
  }

  return [u0, v0, u1, v1];
}

describe("slotNameOf / baseSlotOf", () => {
  it("names every face after the 2D editor's vocabulary", () => {
    assert.equal(slotNameOf(FACE.PosX), "right");
    assert.equal(slotNameOf(FACE.NegX), "left");
    assert.equal(slotNameOf(FACE.PosY), "top");
    assert.equal(slotNameOf(FACE.NegY), "bottom");
    assert.equal(slotNameOf(FACE.PosZ), "front");
    assert.equal(slotNameOf(FACE.NegZ), "back");
  });

  it("resolves a derived slot back to the slot it inherits from", () => {
    assert.equal(baseSlotOf("top.1"), "top");
    assert.equal(baseSlotOf("top"), "top");
  });
});

describe("shapeSlots — shapes with one polygon per face", () => {
  it("gives each face exactly one slot under its bare name", () => {
    for (const shape of [new Cube(), new Slab("bottom"), new Pole(), new PoleY()]) {
      assert.deepEqual(
        idsOf(shape),
        ["right", "left", "top", "bottom", "front", "back"],
        shape.id
      );
    }
  });

  it("leaves a pole's sub-tile face on its authored projection", () => {
    const right = shapeSlots(new Pole())
      .find((slot) => slot.id === "right")!;

    assert.deepEqual(
      boundsOf(right),
      [0, 3 / 8, 1, 5 / 8],
      "rescaling an unsplit slot would repaint every pole in the world"
    );
  });

  it("leaves a slab's half-height side on its authored projection", () => {
    const right = shapeSlots(new Slab("bottom"))
      .find((slot) => slot.id === "right")!;
    const [, v0, , v1] = boundsOf(right);

    assert.equal(
      v1 - v0,
      0.5,
      "a slab's side shows half of its tile, not the whole of it"
    );
  });

  it("skips a face the shape never emits", () => {
    assert.deepEqual(
      idsOf(new Ramp()),
      ["right", "left", "top", "bottom", "front"]
    );
    assert.equal(idsOf(new RampCornerOuter()).includes("top"), false);
  });
});

describe("shapeSlots — stairs", () => {
  it("derives eight slots for a straight stair", () => {
    assert.deepEqual(
      idsOf(new Stair()),
      [
        "right",
        "left",
        "top",
        "top.1",
        "bottom",
        "front",
        "back",
        "back.1"
      ]
    );
  });

  it("shares a slot between coplanar quads, so a side stays one surface", () => {
    const right = shapeSlots(new Stair())
      .find((slot) => slot.id === "right")!;

    assert.equal(right.definitions.length, 2);
    assert.deepEqual(
      boundsOf(right),
      [0, 0, 1, 1],
      "the two quads span the tile, leaving the notch of an L uncovered"
    );
  });

  it("splits quads on different planes into a slot each", () => {
    const slots = shapeSlots(new Stair());

    for (const id of ["top", "top.1", "back", "back.1"]) {
      const slot = slots.find((candidate) => candidate.id === id)!;

      assert.equal(slot.definitions.length, 1, id);
    }
  });

  it("keeps a split slot on its own half of the tile", () => {
    const slots = shapeSlots(new Stair());
    const top = slots.find((slot) => slot.id === "top")!;
    const tread = slots.find((slot) => slot.id === "top.1")!;

    assert.deepEqual(
      boundsOf(top),
      [0, 0.5, 1, 1],
      "a stair's platform is half a tile deep, like a slab side"
    );
    assert.deepEqual(boundsOf(tread), [0, 0, 1, 0.5]);
  });

  it("leaves the two halves of a face abutting, never overlapping", () => {
    const slots = shapeSlots(new Stair());
    const back = boundsOf(slots.find((slot) => slot.id === "back")!);
    const riser = boundsOf(slots.find((slot) => slot.id === "back.1")!);

    assert.equal(
      back[3],
      riser[1],
      "sharing one tile reproduces exactly what a stair rendered before"
    );
  });

  it("derives nine slots for either stair corner", () => {
    assert.equal(idsOf(new StairCornerInner()).length, 9);
    assert.equal(idsOf(new StairCornerOuter()).length, 9);
  });

  it("groups a corner's non-adjacent coplanar quads into one slot", () => {
    const left = shapeSlots(new StairCornerInner())
      .find((slot) => slot.id === "left")!;

    assert.equal(left.definitions.length, 2);
  });
});

describe("shapeSlots — an explicit slot overrides the plane rule", () => {
  it("keeps a ramp corner's slope and its flat top on one tile", () => {
    const top = shapeSlots(new RampCornerInner())
      .find((slot) => slot.id === "top")!;

    assert.equal(top.definitions.length, 2);
    assert.equal(
      idsOf(new RampCornerInner()).includes("top.1"),
      false,
      "pinning both polygons keeps the plane rule from splitting them"
    );
  });

  it("leaves a pinned slot unscaled, since its face carries no other slot", () => {
    const top = shapeSlots(new RampCornerInner())
      .find((slot) => slot.id === "top")!;

    assert.deepEqual(boundsOf(top), [0, 0, 1, 1]);
  });
});

describe("shapeSlots — memoization", () => {
  it("returns the same slots for the same shape", () => {
    const shape = new Stair();

    assert.equal(shapeSlots(shape), shapeSlots(shape));
  });
});
