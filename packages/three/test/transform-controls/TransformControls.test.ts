// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { TransformControls } from "#src/index.ts";
import { pointerAt } from "../fixtures/pointer.ts";
import { assertVector, createHarness } from "./harness.ts";

describe("appearance", () => {
  test("shows positive arrows and plane handles by default", () => {
    const harness = createHarness();

    assert.deepEqual(harness.visibleHandles(), [
      "translate-x-positive",
      "translate-y-positive",
      "translate-z-positive",
      "translate-plane-yz",
      "translate-plane-xz",
      "translate-plane-xy"
    ]);

    harness.controls.dispose();
  });

  test("swaps the visible handle set with the mode", () => {
    const harness = createHarness();

    harness.controls.mode = "rotate";
    assert.deepEqual(harness.visibleHandles(), [
      "rotate-x-positive",
      "rotate-y-positive",
      "rotate-z-positive",
      "rotate-view"
    ]);

    harness.controls.mode = "scale";
    assert.deepEqual(harness.visibleHandles(), [
      "scale-x-positive",
      "scale-y-positive",
      "scale-z-positive",
      "scale-plane-yz",
      "scale-plane-xz",
      "scale-plane-xy"
    ]);

    harness.controls.dispose();
  });

  test("builds the handles of a mode the first time it shows on a target", () => {
    const controls = new TransformControls(new THREE.PerspectiveCamera());
    function built(): string[] {
      const names: string[] = [];
      controls.helper.traverse((object) => {
        if (object.name.startsWith("transform-handle-")) {
          names.push(object.name);
        }
      });

      return names;
    }

    controls.mode = "rotate";
    assert.deepEqual(built(), []);

    controls.mode = "scale";
    controls.attach(new THREE.Object3D());
    assert.ok(built().every((name) => !name.includes("-rotate-")));
    const scaleOnly = built().length;

    controls.mode = "translate";
    controls.mode = "scale";
    const translateAndScale = built().length;
    assert.ok(translateAndScale > scaleOnly);

    controls.mode = "translate";
    assert.equal(built().length, translateAndScale);

    controls.dispose();
  });

  test("starts the axis handles at the gap, joined at the origin by default", () => {
    const cases = [
      {
        appearance: {},
        gap: 0
      },
      {
        appearance: {
          gap: 0.2
        },
        gap: 0.2
      }
    ];

    for (const { appearance, gap } of cases) {
      const harness = createHarness({ appearance });
      assertVector(harness.handle("x-positive").position, [gap, 0, 0]);
      assertVector(harness.handle("y-positive").position, [0, gap, 0]);
      assertVector(harness.handle("z-positive").position, [0, 0, gap]);
      harness.controls.dispose();
    }
  });

  test("draws the axis pointing at the camera above the others", () => {
    const harness = createHarness();
    harness.lookFrom(1, 1, 10);

    function order(
      key: string
    ): number {
      return harness
        .handle(key)
        .getObjectByName("transform-handle-visual")!
        .renderOrder;
    }

    assert.ok(order("z-positive") > order("x-positive"));
    assert.ok(order("z-positive") > order("y-positive"));

    harness.lookFrom(1, 1, -10);
    assert.ok(order("z-positive") < order("x-positive"));

    harness.controls.dispose();
  });

  test("draws the center above every axis handle", () => {
    const harness = createHarness({
      appearance: {
        center: {}
      }
    });
    harness.lookFrom(0, 0, 10);

    const center = harness.handle("center");
    const axis = harness.handle("z-positive");
    const centerOrder = center
      .getObjectByName("transform-handle-outline")!
      .renderOrder;
    const axisOrder = axis
      .getObjectByName("transform-handle-visual")!
      .renderOrder;
    assert.ok(centerOrder > axisOrder);

    harness.controls.dispose();
  });

  test("supports mirrored directions and excluded axes", () => {
    const harness = createHarness({
      appearance: {
        directions: "both",
        axes: {
          y: false
        }
      }
    });

    assert.deepEqual(harness.visibleHandles(), [
      "translate-x-positive",
      "translate-x-negative",
      "translate-z-positive",
      "translate-z-negative",
      "translate-plane-xz"
    ]);

    harness.controls.dispose();
  });

  test("omits planes, the view ring and outlines on request", () => {
    const harness = createHarness({
      mode: "rotate",
      appearance: {
        planes: false,
        viewRing: false,
        outline: false
      }
    });

    assert.deepEqual(harness.visibleHandles(), [
      "rotate-x-positive",
      "rotate-y-positive",
      "rotate-z-positive"
    ]);
    harness.controls.mode = "translate";
    assert.deepEqual(harness.visibleHandles(), [
      "translate-x-positive",
      "translate-y-positive",
      "translate-z-positive"
    ]);
    assert.equal(
      harness.controls.helper.getObjectByName("transform-handle-outline"),
      undefined
    );

    harness.controls.dispose();
  });

  test("keeps the center visual-only unless it is interactive", () => {
    const passive = createHarness({
      appearance: {
        center: {
          color: "#f4f1e8"
        }
      }
    });
    const center = passive.handle("center");
    const visual = center.getObjectByName(
      "transform-handle-visual"
    ) as THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;

    assert.equal(visual.material.color.getHexString(), "f4f1e8");
    assert.ok(center.getObjectByName("transform-handle-outline"));
    assert.equal(center.getObjectByName("transform-handle-picker"), undefined);
    assert.equal(
      passive.controls.isOverHandle(pointerAt({
        camera: passive.camera,
        element: passive.element,
        target: new THREE.Vector3(),
        type: "pointerdown"
      })),
      false
    );
    passive.controls.dispose();

    const interactive = createHarness({
      appearance: {
        center: {
          interactive: true
        }
      }
    });
    interactive.send("pointermove", new THREE.Vector3());
    assert.deepEqual(interactive.controls.hoveredHandle, { kind: "center" });
    interactive.controls.dispose();
  });

  test("hides view-aligned handles only on request", () => {
    const always = createHarness();
    always.lookFrom(10, 0, 0);
    assert.ok(always.visibleHandles().includes("translate-x-positive"));
    always.controls.dispose();

    const hiding = createHarness({
      appearance: {
        hideAligned: true
      }
    });
    hiding.lookFrom(10, 0, 0);
    assert.deepEqual(hiding.visibleHandles(), [
      "translate-y-positive",
      "translate-z-positive",
      "translate-plane-yz"
    ]);
    hiding.controls.dispose();
  });

  test("flips single-direction handles toward the camera on request", () => {
    const harness = createHarness({
      appearance: {
        flipTowardCamera: true
      }
    });
    harness.lookFrom(-5, 4, 7);

    function pointing(
      key: string
    ): THREE.Vector3 {
      return new THREE.Vector3(0, 1, 0)
        .applyQuaternion(harness.handle(key).quaternion);
    }

    assert.ok(pointing("x-positive").x < 0);
    assert.ok(pointing("z-positive").z > 0);
    assert.ok(harness.pointOnHandle("plane-xy").x < 0);
    assert.ok(harness.pointOnHandle("plane-xy").y > 0);

    harness.controls.dispose();
  });
});
