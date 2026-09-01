// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { inflateEdgesGeometry } from "#src/selection/overlays/inflateEdgesGeometry.ts";

function nearestVertex(
  position: THREE.BufferAttribute,
  target: THREE.Vector3
): THREE.Vector3 {
  let best = new THREE.Vector3();
  let bestDistanceSquared = Infinity;

  for (let i = 0; i < position.count; i++) {
    const candidate = new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i));
    const distanceSquared = candidate.distanceToSquared(target);
    if (distanceSquared < bestDistanceSquared) {
      bestDistanceSquared = distanceSquared;
      best = candidate;
    }
  }

  return best;
}

describe("inflateEdgesGeometry", () => {
  test("offset 0 matches a plain THREE.EdgesGeometry exactly", () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const inflated = inflateEdgesGeometry(geometry, 0);
    const plain = new THREE.EdgesGeometry(geometry);

    assert.strictEqual(inflated.getAttribute("position").count, plain.getAttribute("position").count);
    assert.deepStrictEqual(
      Array.from(inflated.getAttribute("position").array),
      Array.from(plain.getAttribute("position").array)
    );
  });

  test("on a box (star-convex), an edge vertex moves away from the origin", () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const corner = new THREE.Vector3(0.5, 0.5, 0.5);

    const before = nearestVertex(new THREE.EdgesGeometry(geometry).getAttribute("position"), corner);
    const after = nearestVertex(inflateEdgesGeometry(geometry, 0.1).getAttribute("position"), corner);

    assert.ok(
      after.length() > before.length(),
      "a convex corner's own outward normal points away from origin, same as the old scale-from-origin behavior"
    );
  });

  test("on a torus (non-star-convex), the inner (hole-facing) rim moves toward the axis, not away from origin", () => {
    // radius 1, tube 0.4 - the inner-equator point at angle 0 sits at
    // (radius - tube, 0, 0) = (0.6, 0, 0), where the true surface normal
    // points back toward the main axis (see `inflateEdgesGeometry`'s own
    // doc comment for why that's the opposite of "away from origin").
    const geometry = new THREE.TorusGeometry(1, 0.4, 16, 48);
    const innerEquatorPoint = new THREE.Vector3(0.6, 0, 0);

    const before = nearestVertex(new THREE.EdgesGeometry(geometry).getAttribute("position"), innerEquatorPoint);
    const after = nearestVertex(inflateEdgesGeometry(geometry, 0.05).getAttribute("position"), innerEquatorPoint);

    const beforeAxisDistance = Math.hypot(before.x, before.z);
    const afterAxisDistance = Math.hypot(after.x, after.z);

    assert.ok(
      afterAxisDistance < beforeAxisDistance,
      "must move toward the main axis (its true outward normal), not away from origin like a uniform scale would"
    );
  });

  test("falls back to computing normals when the source geometry has none, without mutating it", () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    geometry.deleteAttribute("normal");

    assert.doesNotThrow(() => inflateEdgesGeometry(geometry, 0.1));
    assert.strictEqual(geometry.getAttribute("normal"), undefined);
  });
});
