// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  AreaBox,
  BoxControls,
  type BoxControlsOptions,
  type BoxDragEvent,
  type BoxFlipEvent,
  type BoxRotateEvent
} from "#src/index.ts";
import {
  createPointerTarget,
  pointerAt,
  type PointerAtOptions
} from "./pointer.ts";

export interface Harness {
  area: AreaBox;
  camera: THREE.PerspectiveCamera;
  controls: BoxControls;
  element: HTMLElement;
  scene: THREE.Scene;
  changes: BoxDragEvent[];
  starts: unknown[];
  ends: BoxDragEvent[];
  rotations: BoxRotateEvent[];
  flips: BoxFlipEvent[];
  /**
   * Refreshes world matrices, as a renderer would between two frames.
   */
  render: () => void;
  send: (options: Omit<PointerAtOptions, "camera" | "element">) => void;
  at: (x: number, y: number, z: number) => THREE.Vector3;
}

export function createHarness(
  options: BoxControlsOptions = {}
): Harness {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(6, 12, 14);
  camera.lookAt(0, 0, 0);

  const element = createPointerTarget();
  const area = new AreaBox({ size: { x: 8, y: 1, z: 8 } });
  scene.add(area);

  const controls = new BoxControls(camera, element, options);
  controls.attach(area);
  scene.updateMatrixWorld(true);

  const changes: BoxDragEvent[] = [];
  const starts: unknown[] = [];
  const ends: BoxDragEvent[] = [];
  const rotations: BoxRotateEvent[] = [];
  const flips: BoxFlipEvent[] = [];
  controls.addEventListener("start", (event) => starts.push(event));
  controls.addEventListener("change", (event) => changes.push(event));
  controls.addEventListener("end", (event) => ends.push(event));
  controls.addEventListener("rotate", ({ axis, turns }) => {
    rotations.push({
      axis,
      turns
    });
  });
  controls.addEventListener("flip", ({ axis }) => {
    flips.push({ axis });
  });

  return {
    area,
    camera,
    controls,
    element,
    scene,
    changes,
    starts,
    ends,
    rotations,
    flips,
    render: () => scene.updateMatrixWorld(true),
    send: (pointer) => {
      element.dispatchEvent(
        pointerAt({ ...pointer, camera, element })
      );
    },
    at: (x, y, z) => new THREE.Vector3(x, y, z)
  };
}

/**
 * World center of the picker instance sitting on the face with the highest
 * (or lowest) coordinate along the given axis. The pickers are instances of
 * the one InstancedMesh that is never rendered.
 */
export function pickerCenter(
  area: THREE.Object3D,
  axis: "x" | "y" | "z",
  sign: 1 | -1
): THREE.Vector3 {
  const centers: THREE.Vector3[] = [];
  area.traverse((child) => {
    if (child instanceof THREE.InstancedMesh && child.visible === false) {
      const matrix = new THREE.Matrix4();
      for (let instance = 0; instance < child.count; instance++) {
        child.getMatrixAt(instance, matrix);
        centers.push(
          new THREE.Vector3()
            .setFromMatrixPosition(matrix)
            .applyMatrix4(child.matrixWorld)
        );
      }
    }
  });

  assert.ok(centers.length > 0, "expected resize pickers in the area");

  return centers.reduce((best, candidate) => {
    const better = sign === 1
      ? candidate[axis] > best[axis]
      : candidate[axis] < best[axis];

    return better ? candidate : best;
  });
}
