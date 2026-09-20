// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type ControlsHarness,
  createHarness
} from "./harness.ts";

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

function bounds(
  mesh: PlaneMesh
): THREE.Box3 {
  mesh.geometry.computeBoundingBox();
  assert.ok(mesh.geometry.boundingBox);

  return mesh.geometry.boundingBox;
}

function assertClose(
  actual: number,
  expected: number,
  message: string
): void {
  assert.ok(
    Math.abs(actual - expected) < 1e-6,
    `${message}: expected ${expected}, received ${actual}`
  );
}

describe("plane handles", () => {
  test("anchors the inner corner against the axes at any size", () => {
    for (const size of [0.3, 0.6]) {
      const harness = createHarness({
        appearance: {
          planes: {
            size
          }
        }
      });

      for (const key of kPlaneKeys) {
        const box = bounds(part(harness, key, "visual"));
        assertClose(box.min.x, 0.03, `${key} inner x`);
        assertClose(box.min.y, 0.03, `${key} inner y`);
        assertClose(box.max.x, 0.03 + size, `${key} outer x`);
        assertClose(box.max.z - box.min.z, 0, `${key} thickness`);
      }

      harness.controls.dispose();
    }
  });

  test("lays each handle in the quadrant of its two axes", () => {
    const harness = createHarness();
    const expected: Record<string, [number, number, number]> = {
      "plane-xy": [1, 1, 0],
      "plane-xz": [1, 0, 1],
      "plane-yz": [0, 1, 1]
    };

    for (const [key, signs] of Object.entries(expected)) {
      const point = harness.pointOnHandle(key);
      signs.forEach((sign, index) => {
        const value = point.getComponent(index);
        assert.ok(
          sign === 0 ? Math.abs(value) < 1e-6 : value > 0,
          `${key} component ${index}: ${value}`
        );
      });
    }

    harness.controls.dispose();
  });

  test("clears the gap and the center unless an inset is given", () => {
    const cases = [
      {
        appearance: {
          gap: 0.2
        },
        inset: 0.2
      },
      {
        appearance: {
          center: {}
        },
        inset: 0.1
      },
      {
        appearance: {
          center: {
            interactive: true
          }
        },
        inset: 0.125
      },
      {
        appearance: {
          center: {},
          planes: {
            inset: 0
          }
        },
        inset: 0
      }
    ];

    for (const { appearance, inset } of cases) {
      const harness = createHarness({ appearance });
      assertClose(
        bounds(part(harness, "plane-xy", "visual")).min.x,
        inset,
        JSON.stringify(appearance)
      );
      harness.controls.dispose();
    }

    assert.throws(
      () => createHarness({
        appearance: {
          planes: {
            inset: -0.1
          }
        }
      }),
      RangeError
    );
  });

  test("grows the picker away from the axes only", () => {
    const harness = createHarness();
    const visual = bounds(part(harness, "plane-xy", "visual"));
    const picker = bounds(part(harness, "plane-xy", "picker"));

    assertClose(picker.min.x, visual.min.x, "inner x");
    assertClose(picker.min.y, visual.min.y, "inner y");
    assert.ok(picker.max.x > visual.max.x);
    assert.ok(picker.max.y > visual.max.y);

    harness.controls.dispose();
  });

  test("borders the two outer edges with an opaque strip", () => {
    const harness = createHarness();
    const visual = part(harness, "plane-xy", "visual");
    const border = part(harness, "plane-xy", "border");

    assert.equal(border.material.opacity, 1);
    assertClose(visual.material.opacity, 0.3, "fill opacity");
    assert.equal(visual.material.side, THREE.DoubleSide);
    assert.equal(border.material.side, THREE.DoubleSide);

    const box = bounds(border);
    assertClose(box.max.x, 0.33, "border outer x");
    assertClose(box.max.y, 0.33, "border outer y");
    const position = border.geometry.getAttribute("position");
    for (let index = 0; index < position.count; index++) {
      const onOuterEdge = position.getX(index) >= 0.31 - 1e-6 ||
        position.getY(index) >= 0.31 - 1e-6;
      assert.ok(onOuterEdge, `vertex ${index} leaves the outer edges`);
    }

    harness.send("pointermove", harness.pointOnHandle("plane-xy"));
    assert.equal(visual.material.color.getHexString(), "ffd452");
    assert.equal(border.material.color.getHexString(), "ffd452");

    harness.controls.dispose();
  });

  test("omits the border on request", () => {
    const harness = createHarness({
      appearance: {
        planes: {
          border: false
        }
      }
    });

    assert.equal(findPart(harness, "plane-xy", "border"), undefined);

    harness.controls.dispose();
  });

  test("paints the normal axis color or the in-plane blend", () => {
    const axes = {
      x: {
        color: "#ff0000"
      },
      y: {
        color: "#00ff00"
      },
      z: {
        color: "#0000ff"
      }
    };
    const normal = createHarness({
      appearance: { axes }
    });
    assert.equal(
      part(normal, "plane-xy", "visual").material.color.getHexString(),
      "0000ff"
    );
    normal.controls.dispose();

    const blend = createHarness({
      appearance: {
        axes,
        planes: {
          color: "blend"
        }
      }
    });
    const colors = kPlaneKeys.map(
      (key) => part(blend, key, "visual").material.color.getHexString()
    );
    assert.deepEqual(colors, ["ffff00", "ff00ff", "00ffff"]);
    blend.controls.dispose();
  });

  test("picks from behind", () => {
    const harness = createHarness();
    harness.camera.position.set(5, 4, -7);
    harness.camera.lookAt(0, 0, 0);
    harness.scene.updateMatrixWorld(true);

    harness.send("pointermove", harness.pointOnHandle("plane-xy"));
    assert.deepEqual(harness.controls.hoveredHandle, {
      kind: "plane",
      normal: "z"
    });

    harness.controls.dispose();
  });

  test("stays visible but refuses a pick when seen edge-on", () => {
    const harness = createHarness();
    harness.camera.position.set(10, 0.5, 0);
    harness.camera.lookAt(0, 0, 0);
    harness.scene.updateMatrixWorld(true);

    assert.ok(harness.visibleHandles().includes("translate-plane-xy"));
    harness.send("pointermove", harness.pointOnHandle("plane-xy"));
    assert.notEqual(harness.controls.hoveredHandle?.kind, "plane");

    harness.send("pointermove", harness.pointOnHandle("plane-yz"));
    assert.deepEqual(harness.controls.hoveredHandle, {
      kind: "plane",
      normal: "x"
    });

    harness.controls.dispose();
  });

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
    harness.camera.position.set(0, 0, 10);
    harness.camera.lookAt(0, 0, 0);
    harness.scene.updateMatrixWorld(true);

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
    harness.camera.position.set(1, 8, 2);
    harness.camera.lookAt(0, 0, 0);
    harness.scene.updateMatrixWorld(true);

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
