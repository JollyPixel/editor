// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type BoxFace,
  faceCenter
} from "#src/box/faceCenter.ts";

// CONSTANTS
const kMin = { x: 2, y: 0, z: -4 };
const kSize = { x: 8, y: 2, z: 6 };

describe("faceCenter", () => {
  const cases: { face: BoxFace; expected: THREE.Vector3Tuple; }[] = [
    {
      face: { axis: "x", sign: 1 },
      expected: [10, 1, -1]
    },
    {
      face: { axis: "y", sign: 1 },
      expected: [6, 2, -1]
    },
    {
      face: { axis: "z", sign: -1 },
      expected: [6, 1, -4]
    }
  ];

  for (const { face, expected } of cases) {
    const side = face.sign === 1 ? "max" : "min";

    test(`centers the ${side} ${face.axis} face`, () => {
      const target = new THREE.Vector3();

      faceCenter(kMin, kSize, face, target);

      assert.deepEqual(target.toArray(), expected);
    });
  }
});
