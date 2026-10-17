// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { normalizeSlotKey, unknownTextureSlots } from "../../../../src/document/blocks/shape/shapeSlots.ts";
import {
  Cube,
  Ramp,
  Stair
} from "../../../../src/document/blocks/shape/library/index.ts";
import type { BlockShape } from "../../../../src/document/blocks/shape/BlockShape.ts";
import { FACE } from "../../../../src/document/geometry/faceDirection.ts";

describe("normalizeSlotKey", () => {
  it("reads a numeric face key as that face's slot", () => {
    assert.equal(normalizeSlotKey(String(FACE.NegY)), "bottom");
    assert.equal(normalizeSlotKey("top.1"), "top.1");
    assert.equal(normalizeSlotKey("6"), "6");
  });
});

describe("unknownTextureSlots", () => {
  it("reports keys that name no slot", () => {
    assert.deepEqual(
      unknownTextureSlots(["top", "negY", "posX"], new Cube()),
      ["negY", "posX"]
    );
  });

  it("accepts numeric face keys", () => {
    assert.deepEqual(
      unknownTextureSlots([String(FACE.NegZ), String(FACE.PosY)], new Cube()),
      []
    );
  });

  it("accepts a built-in face name the shape does not use", () => {
    assert.deepEqual(unknownTextureSlots(["back"], new Ramp()), []);
  });

  it("accepts derived slots of the shape only", () => {
    assert.deepEqual(
      unknownTextureSlots(["top.1", "back.1", "front.1"], new Stair()),
      ["front.1"]
    );
  });

  it("accepts a slot a shape pins under its own name", () => {
    const shape: BlockShape = {
      id: "capped",
      faces: [
        {
          ...new Cube().faces[0],
          slot: "cap"
        }
      ],
      collisionHint: "box",
      occludes: () => false
    };

    assert.deepEqual(unknownTextureSlots(["cap", "lid"], shape), ["lid"]);
  });
});
