// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { BoxEdgesGeometry } from "#src/box/BoxEdgesGeometry.ts";

function segmentKey(
  from: THREE.Vector3Tuple,
  to: THREE.Vector3Tuple
): string {
  return [from.join(","), to.join(",")].sort().join(" ");
}

function boxEdgeKeys(
  size: THREE.Vector3Like
): string[] {
  const corners: THREE.Vector3Tuple[] = [];
  for (const x of [0, size.x]) {
    for (const y of [0, size.y]) {
      for (const z of [0, size.z]) {
        corners.push([x, y, z]);
      }
    }
  }

  const keys: string[] = [];
  corners.forEach((from, index) => {
    for (const to of corners.slice(index + 1)) {
      const differing = from.filter((value, axis) => value !== to[axis]);
      if (differing.length === 1) {
        keys.push(segmentKey(from, to));
      }
    }
  });

  return keys.sort();
}

function tracedKeys(
  geometry: BoxEdgesGeometry
): string[] {
  const start = geometry.getAttribute("instanceStart");
  const end = geometry.getAttribute("instanceEnd");
  const keys: string[] = [];
  for (let index = 0; index < geometry.instanceCount; index++) {
    keys.push(segmentKey(
      [start.getX(index), start.getY(index), start.getZ(index)],
      [end.getX(index), end.getY(index), end.getZ(index)]
    ));
  }

  return keys.sort();
}

describe("BoxEdgesGeometry", () => {
  const cases = [
    {
      name: "a unit box by default",
      create: () => new BoxEdgesGeometry(),
      size: { x: 1, y: 1, z: 1 }
    },
    {
      name: "the requested size",
      create: () => new BoxEdgesGeometry({ x: 6, y: 3, z: 4 }),
      size: { x: 6, y: 3, z: 4 }
    }
  ];

  for (const { name, create, size } of cases) {
    test(`traces the twelve edges of ${name} from the min corner`, () => {
      const geometry = create();

      assert.deepEqual(tracedKeys(geometry), boxEdgeKeys(size));
      assert.deepEqual(geometry.boundingBox!.min.toArray(), [0, 0, 0]);
      assert.deepEqual(
        geometry.boundingBox!.max.toArray(),
        [size.x, size.y, size.z]
      );
    });
  }

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
