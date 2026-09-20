// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { BoxEdgesGeometry } from "#src/box/BoxEdgesGeometry.ts";

describe("BoxEdgesGeometry", () => {
  test("traces twelve segments from the min corner", () => {
    const geometry = new BoxEdgesGeometry({ x: 6, y: 3, z: 4 });

    assert.equal(geometry.instanceCount, 12);
    assert.deepEqual(geometry.boundingBox!.min.toArray(), [0, 0, 0]);
    assert.deepEqual(geometry.boundingBox!.max.toArray(), [6, 3, 4]);
  });

  test("reports whether a resize changed the size", () => {
    const geometry = new BoxEdgesGeometry({ x: 1, y: 1, z: 1 });

    assert.equal(geometry.resize({ x: 1, y: 1, z: 1 }), false);
    assert.equal(geometry.resize({ x: 2, y: 1, z: 1 }), true);
    assert.deepEqual(geometry.copySizeTo().toArray(), [2, 1, 1]);
  });

  test("flags the shared buffer for upload on a real resize", () => {
    const geometry = new BoxEdgesGeometry();
    const start = geometry.getAttribute("instanceStart");
    const end = geometry.getAttribute("instanceEnd");
    assert.ok(start instanceof THREE.InterleavedBufferAttribute);
    assert.ok(end instanceof THREE.InterleavedBufferAttribute);
    const version = start.data.version;

    geometry.resize({ x: 2, y: 2, z: 2 });

    assert.equal(geometry.getAttribute("instanceStart"), start);
    assert.equal(end.data, start.data);
    assert.ok(start.data.version > version);
  });
});
