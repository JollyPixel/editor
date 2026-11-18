// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { HaloLines } from "#src/common/lines/HaloLines.ts";

describe("redraw", () => {
  test("keeps lines hidden by their owner hidden", () => {
    const lines = new HaloLines("#ffffff");
    lines.visible = false;

    lines.redraw([
      new THREE.Vector3(-1, 0, -1),
      new THREE.Vector3(1, 0, -1)
    ]);

    assert.strictEqual(lines.visible, false);
  });
});

describe("raycast", () => {
  test("ignores a ray cast without a camera instead of logging an error", (t) => {
    const errors = t.mock.method(console, "error", () => undefined);
    const lines = new HaloLines("#ffffff");
    lines.redraw([
      new THREE.Vector3(-1, 0, -1),
      new THREE.Vector3(1, 0, -1)
    ]);
    lines.updateMatrixWorld();
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(0, 1, -1),
      new THREE.Vector3(0, -1, 0)
    );

    const hits = raycaster.intersectObject(lines, true);

    assert.deepEqual(hits, []);
    assert.strictEqual(errors.mock.callCount(), 0);
  });
});
