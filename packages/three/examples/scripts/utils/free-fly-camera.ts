// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { UpdatableControls } from "./common.ts";

// CONSTANTS
const kDefaultMoveSpeed = 4;
// Radians of camera rotation per pixel of pointer-locked mouse movement.
const kLookSpeed = 0.0025;
// Keeps the camera just short of a straight-up/down look (gimbal lock).
const kMaxPitch = Math.PI / 2 - 0.01;

export interface FreeFlyCameraOptions {
  /**
   * World units per second.
   * @default 4
   */
  moveSpeed?: number;
}

export interface FreeFlyCameraResult {
  camera: THREE.PerspectiveCamera;
  controls: UpdatableControls;
}

/**
 * WASD + mouse-look free-fly ("no-clip") camera: click the canvas to lock
 * the pointer, then look around freely and move exactly along that look
 * direction on all three axes (Space/Shift for straight up/down instead).
 * Unlike `OrbitControls` (orbits a fixed target) or a walk camera (stays
 * level), this behaves like a spectator camera in a 3D world.
 */
export function createFreeFlyCamera(
  canvas: HTMLCanvasElement,
  position: THREE.Vector3Like,
  options: FreeFlyCameraOptions = {}
): FreeFlyCameraResult {
  const { moveSpeed = kDefaultMoveSpeed } = options;

  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    500
  );
  camera.position.set(
    position.x,
    position.y,
    position.z
  );

  let yaw = 0;
  let pitch = 0;
  const pressedKeys = new Set<string>();
  const clock = new THREE.Clock();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const movement = new THREE.Vector3();

  canvas.addEventListener("click", () => canvas.requestPointerLock());

  document.addEventListener("mousemove", (event) => {
    if (document.pointerLockElement !== canvas) {
      return;
    }

    yaw -= event.movementX * kLookSpeed;
    pitch -= event.movementY * kLookSpeed;
    pitch = Math.max(-kMaxPitch, Math.min(kMaxPitch, pitch));
    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
  });

  document.addEventListener("keydown", (event) => pressedKeys.add(event.code));
  document.addEventListener("keyup", (event) => pressedKeys.delete(event.code));

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

  return { camera, controls: { update } };
}
