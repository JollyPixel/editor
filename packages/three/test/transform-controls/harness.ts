// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  TransformControls,
  type TransformControlsOptions,
  type TransformMode
} from "#src/index.ts";
import {
  createPointerTarget,
  pointerAt
} from "../fixtures/pointer.ts";

// CONSTANTS
export const QUARTER_TURN = Math.PI / 2;
export const UP = new THREE.Vector3(0, 1, 0);

interface SendOptions {
  altKey?: boolean;
  button?: number;
  pointerId?: number;
}

export interface ControlsHarness {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  element: HTMLElement;
  target: THREE.Object3D;
  controls: TransformControls;
  handle(key: string, mode?: TransformMode): THREE.Object3D;
  pointOnHandle(key: string, mode?: TransformMode): THREE.Vector3;
  pointOnRing(key: string): THREE.Vector3;
  gizmoScale(): number;
  visibleHandles(): string[];
  send(
    type: "pointerdown" | "pointermove" | "pointerup",
    point: THREE.Vector3,
    options?: SendOptions
  ): void;
  drag(from: THREE.Vector3, to: THREE.Vector3, options?: SendOptions): void;
}

export function createHarness(
  options: TransformControlsOptions = {}
): ControlsHarness {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(5, 4, 7);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);

  const element = createPointerTarget();
  const target = new THREE.Object3D();
  const controls = new TransformControls(camera, element, options);
  scene.add(target, controls.helper);
  controls.attach(target);
  scene.updateMatrixWorld(true);

  const harness: ControlsHarness = {
    scene,
    camera,
    element,
    target,
    controls,
    handle(
      key,
      mode = controls.mode
    ): THREE.Object3D {
      const name = key === "center"
        ? "transform-handle-center"
        : `transform-handle-${mode}-${key}`;
      const found = controls.helper.getObjectByName(name);
      assert.ok(found, `missing ${name}`);

      return found;
    },
    pointOnHandle(
      key,
      mode
    ): THREE.Vector3 {
      scene.updateMatrixWorld(true);
      const picker = harness.handle(key, mode).getObjectByName(
        "transform-handle-picker"
      ) as THREE.Mesh<THREE.BufferGeometry> | undefined;
      assert.ok(picker, `missing ${key} picker`);
      picker.geometry.computeBoundingBox();
      const center = picker.geometry.boundingBox!.getCenter(
        new THREE.Vector3()
      );

      return picker.localToWorld(center);
    },
    pointOnRing(
      key
    ): THREE.Vector3 {
      scene.updateMatrixWorld(true);
      const radius = key === "view" ? 1.25 : 1;

      return harness
        .handle(key, "rotate")
        .localToWorld(new THREE.Vector3(radius, 0, 0));
    },
    gizmoScale(): number {
      scene.updateMatrixWorld(true);

      return controls.helper.matrixWorld.getMaxScaleOnAxis();
    },
    visibleHandles(): string[] {
      scene.updateMatrixWorld(true);

      return controls.helper.children
        .filter(
          (child) => child.visible &&
            child.name.startsWith("transform-handle-")
        )
        .map((child) => child.name.replace("transform-handle-", ""));
    },
    send(
      type,
      point,
      eventOptions = {}
    ): void {
      element.dispatchEvent(pointerAt({
        camera,
        element,
        target: point,
        type,
        pointerId: eventOptions.pointerId,
        button: eventOptions.button,
        altKey: eventOptions.altKey
      }));
    },
    drag(
      from,
      to,
      eventOptions
    ): void {
      harness.send("pointerdown", from, eventOptions);
      harness.send("pointermove", to, eventOptions);
    }
  };

  return harness;
}

export function rotatedAround(
  point: THREE.Vector3,
  center: THREE.Vector3,
  angle: number
): THREE.Vector3 {
  return point
    .clone()
    .sub(center)
    .applyAxisAngle(UP, angle)
    .add(center);
}

export function assertVector(
  actual: THREE.Vector3,
  expected: [number, number, number],
  message = "vector"
): void {
  expected.forEach((value, index) => {
    assert.ok(
      Math.abs(actual.getComponent(index) - value) < 1e-6,
      `${message}: expected [${expected}], received [${actual.toArray()}]`
    );
  });
}

export function pressEscape(): void {
  document.dispatchEvent(
    new window.KeyboardEvent("keydown", { key: "Escape" })
  );
}
