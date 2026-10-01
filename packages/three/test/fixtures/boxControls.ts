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
  type BoxRotateEvent,
  type BoxVolume
} from "#src/index.ts";
import {
  createPointerTarget,
  pointerAt,
  type PointerAtOptions
} from "./pointer.ts";

export type HarnessPointer = Omit<PointerAtOptions, "camera" | "element">;

export interface Harness<TBox extends BoxVolume = AreaBox> {
  box: TBox;
  camera: THREE.PerspectiveCamera;
  controls: BoxControls<TBox>;
  element: HTMLElement;
  scene: THREE.Scene;
  changes: BoxDragEvent[];
  starts: unknown[];
  ends: BoxDragEvent[];
  rotations: BoxRotateEvent[];
  flips: BoxFlipEvent[];
  render: () => void;
  aim: (
    position: THREE.Vector3Like,
    target: THREE.Vector3Like
  ) => void;
  pointer: (options: HarnessPointer) => PointerEvent;
  send: (options: HarnessPointer) => void;
  click: (target: THREE.Vector3) => void;
  isOver: (target: THREE.Vector3) => boolean;
  at: (x: number, y: number, z: number) => THREE.Vector3;
}

function createAreaBox(): AreaBox {
  return new AreaBox({ size: { x: 8, y: 1, z: 8 } });
}

export function createHarness(
  options?: BoxControlsOptions
): Harness<AreaBox>;
export function createHarness<TBox extends BoxVolume>(
  options: BoxControlsOptions,
  createBox: () => TBox
): Harness<TBox>;
export function createHarness(
  options: BoxControlsOptions = {},
  createBox: () => BoxVolume = createAreaBox
): Harness<BoxVolume> {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  const element = createPointerTarget();
  const box = createBox();
  scene.add(box);

  function aim(
    position: THREE.Vector3Like,
    target: THREE.Vector3Like
  ): void {
    camera.position.copy(position);
    camera.lookAt(target.x, target.y, target.z);
    camera.updateMatrixWorld();
  }
  aim({ x: 6, y: 12, z: 14 }, { x: 0, y: 0, z: 0 });

  const controls = new BoxControls(camera, element, options);
  controls.attach(box);
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

  function pointer(
    event: HarnessPointer
  ): PointerEvent {
    return pointerAt({
      ...event,
      camera,
      element
    });
  }
  function send(
    event: HarnessPointer
  ): void {
    element.dispatchEvent(pointer(event));
  }

  return {
    box,
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
    aim,
    pointer,
    send,
    click: (target) => {
      send({ type: "pointerdown", target });
      send({ type: "pointerup", target });
    },
    isOver: (target) => controls.isOverHandle(
      pointer({ type: "pointerdown", target })
    ),
    at: (x, y, z) => new THREE.Vector3(x, y, z)
  };
}

export function pickerCenter(
  box: THREE.Object3D,
  axis: "x" | "y" | "z",
  sign: 1 | -1
): THREE.Vector3 {
  const centers: THREE.Vector3[] = [];
  box.traverse((child) => {
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

  assert.ok(centers.length > 0, "expected resize pickers in the box");

  return centers.reduce((best, candidate) => {
    const better = sign === 1
      ? candidate[axis] > best[axis]
      : candidate[axis] < best[axis];

    return better ? candidate : best;
  });
}
