// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { type ControlsHarness, createHarness } from "./harness.ts";

// CONSTANTS
const kPlaneKeys = ["plane-xy", "plane-xz", "plane-yz"];
const kAxisKeys = ["x-positive", "y-positive", "z-positive"];

type PlaneMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
type PlanePart = "visual" | "border" | "picker";

function findPart(
  harness: ControlsHarness,
  key: string,
  name: PlanePart
): PlaneMesh | undefined {
  return harness
    .handle(key)
    .getObjectByName(`transform-handle-${name}`) as PlaneMesh | undefined;
}

function part(
  harness: ControlsHarness,
  key: string,
  name: PlanePart
): PlaneMesh {
  const mesh = findPart(harness, key, name);
  assert.ok(mesh, `missing ${key} ${name}`);

  return mesh;
}

describe("plane handles", () => {
  test("yields the hub to an interactive center", () => {
    const harness = createHarness({
      appearance: {
        center: {
          interactive: true
        },
        planes: {
          inset: 0
        }
      }
    });
    harness.lookFrom(0, 0, 10);

    const nearCorner = harness
      .handle("plane-xy")
      .localToWorld(new THREE.Vector3(0.05, 0.05, 0.2));
    harness.send("pointermove", nearCorner);
    assert.deepEqual(harness.controls.hoveredHandle, { kind: "center" });

    harness.send("pointermove", harness.pointOnHandle("plane-xy"));
    assert.deepEqual(harness.controls.hoveredHandle, {
      kind: "plane",
      normal: "z"
    });

    harness.controls.dispose();
  });

  test("draws below the axis handles, nearest plane last", () => {
    const harness = createHarness();
    harness.lookFrom(1, 8, 2);

    function order(
      key: string,
      name: PlanePart = "visual"
    ): number {
      return part(harness, key, name).renderOrder;
    }

    assert.ok(order("plane-yz") > order("plane-xy"));
    assert.equal(order("plane-yz", "border"), order("plane-yz"));
    for (const plane of kPlaneKeys) {
      for (const axis of kAxisKeys) {
        assert.ok(order(plane) < order(axis), `${plane} under ${axis}`);
      }
    }

    harness.controls.dispose();
  });
});
