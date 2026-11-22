// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { SpriteSheet } from "../../../src/components/renderers/sprite/SpriteSheet.ts";

function frameUV(
  frame: number,
  flip = { horizontal: false, vertical: false }
): number[] {
  const texture = new THREE.Texture();
  new SpriteSheet(3, 2).writeFrame(texture, frame, flip);

  return [...texture.repeat.toArray(), ...texture.offset.toArray()];
}

describe("Components.Renderers.SpriteSheet", () => {
  test("should count frames left to right from the top row", () => {
    assert.deepStrictEqual(frameUV(0), [1 / 3, 0.5, 0, 0.5]);
    assert.deepStrictEqual(frameUV(4), [1 / 3, 0.5, 1 / 3, 0]);
  });

  test("should mirror a frame inside its own cell", () => {
    assert.deepStrictEqual(
      frameUV(4, { horizontal: true, vertical: true }),
      [-1 / 3, -0.5, 2 / 3, 0.5]
    );
  });

  test("should refuse a sheet without a whole cell", () => {
    for (const [columns, rows] of [[0, 1], [2, 0], [1.5, 1]]) {
      assert.throws(() => new SpriteSheet(columns, rows), RangeError);
    }
  });
});
