// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  assertClose,
  createHarness
} from "./harness.ts";

describe("display", () => {
  test("fades every handle until one is hovered or dragged", () => {
    const harness = createHarness({
      appearance: {
        idleOpacity: 0.4
      }
    });
    function opacity(
      key: string
    ): number {
      const visual = harness.handle(key).getObjectByName(
        "transform-handle-visual"
      ) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

      return visual.material.opacity;
    }
    const start = harness.pointOnHandle("x-positive");

    assertClose(opacity("y-positive"), 0.4);
    harness.send("pointermove", start);
    assertClose(opacity("y-positive"), 1);
    harness.send("pointerdown", start);
    harness.send("pointerup", start);
    harness.send("pointermove", new THREE.Vector3(-5, -5, -5));
    assertClose(opacity("y-positive"), 0.4);

    harness.controls.mode = "rotate";
    assertClose(opacity("y-positive"), 0.4);

    harness.controls.dispose();
  });

  test("shows only the dragged handle on request", () => {
    const harness = createHarness({
      appearance: {
        hideInactive: true
      }
    });
    const start = harness.pointOnHandle("x-positive");

    harness.send("pointerdown", start);
    assert.deepEqual(harness.visibleHandles(), ["translate-x-positive"]);
    harness.send("pointerup", start);
    assert.equal(harness.visibleHandles().length, 6);

    harness.controls.dispose();
  });

  test("resizes live and rejects a size that is not positive", () => {
    const harness = createHarness();
    const scale = harness.gizmoScale();

    harness.controls.size *= 2;
    assertClose(harness.gizmoScale(), scale * 2);
    assert.throws(() => {
      harness.controls.size = 0;
    }, RangeError);

    harness.controls.dispose();
  });
});
