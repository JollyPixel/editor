// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { plainVector3 } from "#src/scene/blocks/plainVector3.ts";

describe("plainVector3", () => {
  test("flattens a THREE.Euler into own x, y and z keys", () => {
    const plain = plainVector3(new THREE.Euler(0.1, 0.2, 0.3));

    assert.deepEqual(Object.keys(plain), ["x", "y", "z"]);
    assert.equal(
      JSON.stringify(plain),
      "{\"x\":0.1,\"y\":0.2,\"z\":0.3}"
    );
  });

  test("detaches the result from a live THREE.Vector3", () => {
    const source = new THREE.Vector3(1, 2, 3);
    const plain = plainVector3(source);
    source.set(9, 9, 9);

    assert.deepEqual(plain, { x: 1, y: 2, z: 3 });
  });
});
