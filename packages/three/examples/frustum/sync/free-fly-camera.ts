// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  perspectiveCamera,
  type ExampleCameraFactory
} from "../../shared/example.ts";

// CONSTANTS
const kDefaultMoveSpeed = 4;
const kLookSpeed = 0.0025;
const kMaxPitch = Math.PI / 2 - 0.01;

export interface FreeFlyCameraOptions {
  moveSpeed?: number;
}

export function freeFlyCamera(
  position: THREE.Vector3Like,
  options: FreeFlyCameraOptions = {}
): ExampleCameraFactory {
  const { moveSpeed = kDefaultMoveSpeed } = options;

  return (canvas) => {
    const camera = perspectiveCamera(position);

    let yaw = 0;
    let pitch = 0;
    const pressedKeys = new Set<string>();
    const clock = new THREE.Clock();
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const movement = new THREE.Vector3();

    canvas.addEventListener(
      "click",
      () => canvas.requestPointerLock()
    );

    document.addEventListener("mousemove", (event) => {
      if (document.pointerLockElement !== canvas) {
        return;
      }

      yaw -= event.movementX * kLookSpeed;
      pitch -= event.movementY * kLookSpeed;
      pitch = Math.max(-kMaxPitch, Math.min(kMaxPitch, pitch));
      camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
    });

    document.addEventListener(
      "keydown",
      (event) => pressedKeys.add(event.code)
    );
    document.addEventListener(
      "keyup",
      (event) => pressedKeys.delete(event.code)
    );

    function update(): void {
      const delta = clock.getDelta();

      camera.getWorldDirection(forward);
      right.crossVectors(forward, worldUp).normalize();

      movement.set(0, 0, 0);
      if (pressedKeys.has("KeyW")) {
        movement.add(forward);
      }
      if (pressedKeys.has("KeyS")) {
        movement.sub(forward);
      }
      if (pressedKeys.has("KeyD")) {
        movement.add(right);
      }
      if (pressedKeys.has("KeyA")) {
        movement.sub(right);
      }
      if (pressedKeys.has("Space")) {
        movement.add(worldUp);
      }
      if (pressedKeys.has("ShiftLeft") || pressedKeys.has("ShiftRight")) {
        movement.sub(worldUp);
      }

      if (movement.lengthSq() > 0) {
        movement.normalize().multiplyScalar(moveSpeed * delta);
        camera.position.add(movement);
      }
    }

    return {
      camera,
      controls: { update }
    };
  };
}
