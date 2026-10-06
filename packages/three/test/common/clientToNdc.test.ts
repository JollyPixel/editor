// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { clientToNdc } from "#src/common/clientToNdc.ts";

// CONSTANTS
const kBounds = {
  left: 100,
  top: 50,
  width: 200,
  height: 100
};
const kCanvas = {
  getBoundingClientRect: () => kBounds
};

describe("clientToNdc", () => {
  test("maps the canvas corners and centre, with y pointing up", () => {
    assert.deepEqual(clientToNdc(kCanvas, 100, 50)?.toArray(), [-1, 1]);
    assert.deepEqual(clientToNdc(kCanvas, 300, 150)?.toArray(), [1, -1]);
    assert.deepEqual(clientToNdc(kCanvas, 200, 100)?.toArray(), [0, 0]);
  });

  test("extends past the canvas bounds", () => {
    assert.deepEqual(clientToNdc(kCanvas, 400, 0)?.toArray(), [2, 2]);
  });

  test("writes into the given target", () => {
    const target = new THREE.Vector2();

    assert.equal(clientToNdc(kCanvas, 200, 100, target), target);
  });

  test("returns null for an empty canvas", () => {
    const canvas = {
      getBoundingClientRect: () => {
        return {
          ...kBounds,
          width: 0
        };
      }
    };

    assert.equal(clientToNdc(canvas, 100, 100), null);
  });
});
