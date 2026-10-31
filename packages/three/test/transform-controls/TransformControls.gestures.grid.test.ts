// Import Node.js Dependencies
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  assertVector,
  createHarness
} from "./harness.ts";

describe("grid snapping", () => {
  test("snaps the dragged axes of the position to the grid", () => {
    const harness = createHarness({
      snap: {
        translate: 1,
        grid: 0
      }
    });
    harness.target.position.set(0.3, 0.5, -0.4);
    harness.scene.updateMatrixWorld(true);
    const start = harness.pointOnHandle("plane-xz");

    harness.drag(start, start.clone().add(new THREE.Vector3(1.1, 0, 2.6)));

    assertVector(harness.target.position, [1, 0.5, 2]);

    harness.send("pointerup", start);
    harness.controls.dispose();
  });

  test("shifts the grid by the grid offset", () => {
    const harness = createHarness({
      snap: {
        translate: 1,
        grid: 0.5
      }
    });
    const start = harness.pointOnHandle("x-positive");

    harness.drag(start, start.clone().add(new THREE.Vector3(1.2, 0, 0)));

    assertVector(harness.target.position, [1.5, 0, 0]);

    harness.send("pointerup", start);
    harness.controls.dispose();
  });

  test("measures the grid in world space under a parent", () => {
    const harness = createHarness({
      snap: {
        translate: 1,
        grid: 0
      }
    });
    const parent = new THREE.Object3D();
    parent.position.x = 0.25;
    harness.scene.add(parent);
    parent.add(harness.target);
    harness.scene.updateMatrixWorld(true);
    const start = harness.pointOnHandle("x-positive");

    harness.drag(start, start.clone().add(new THREE.Vector3(1.6, 0, 0)));

    assertVector(harness.target.position, [1.75, 0, 0]);

    harness.send("pointerup", start);
    harness.controls.dispose();
  });
});
