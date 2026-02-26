// Import Third-party Dependencies
import * as THREE from "three";
import {
  Actor,
  CameraComponent,
  createViewHelper
} from "@jolly-pixel/engine";

export interface FreeFlyCameraOptions {
  position?: THREE.Vector3Like;
  yaw?: number;
  pitch?: number;
  moveSpeed?: number;
  mouseSensitivity?: number;
  maxPitch?: number;
  scrollSpeed?: number;
  friction?: number;
}

/**
 * Minecraft-style free-fly camera.
 * WASD = horizontal, Space/Shift = vertical, RMB+drag = look.
 * Velocity accumulates each frame and lerps to zero (inertia).
 */
export class FreeFlyCamera extends CameraComponent {
  #vel = new THREE.Vector3();
  #yaw: number;
  #pitch: number;
  #moveSpeed: number;
  #mouseSensitivity: number;
  #maxPitch: number;
  #scrollSpeed: number;
  #friction: number;

  // Reused each frame — avoid allocations.
  #forward = new THREE.Vector3();
  #right = new THREE.Vector3();
  #up = new THREE.Vector3(0, 1, 0);
  #move = new THREE.Vector3();

  constructor(
    actor: Actor,
    options: FreeFlyCameraOptions = {}
  ) {
    super(actor, {
      fov: 60,
      near: 0.1,
      far: 2000
    });

    const {
      moveSpeed = 12,
      mouseSensitivity = 0.003,
      maxPitch = Math.PI / 2 - 0.01,
      scrollSpeed = 8,
      yaw = 0,
      pitch = -0.2,
      friction = 0.24
    } = options;

    this.#yaw = yaw;
    this.#pitch = pitch;
    this.#moveSpeed = moveSpeed;
    this.#mouseSensitivity = mouseSensitivity;
    this.#maxPitch = maxPitch;
    this.#scrollSpeed = scrollSpeed;
    this.#friction = friction;

    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.#yaw;
    this.camera.rotation.x = this.#pitch;

    if (options.position) {
      this.camera.position.copy(options.position);
    }
    else {
      this.camera.position.set(16, 20, 40);
    }
  }

  get camera() {
    return this.threeCamera as THREE.PerspectiveCamera;
  }

  start() {
    createViewHelper(this.threeCamera, this.actor.world);
  }

  update(
    deltaTime: number
  ) {
    const { input } = this.actor.world;

    // --- Mouse look ---
    if (input.isMouseButtonDown("middle") && input.isMouseMoving()) {
      const delta = input.getMouseDelta(false);
      this.#yaw -= delta.x * this.#mouseSensitivity;
      this.#pitch += delta.y * this.#mouseSensitivity;
      this.#pitch = Math.max(
        -this.#maxPitch,
        Math.min(this.#maxPitch, this.#pitch)
      );

      this.camera.rotation.y = this.#yaw;
      this.camera.rotation.x = this.#pitch;
    }

    // --- Compute camera orientation vectors ---
    this.camera.getWorldDirection(this.#forward);
    this.#forward.y = 0;
    this.#forward.normalize();

    this.#right.crossVectors(this.#forward, this.#up).normalize();

    // --- Accumulate movement intent ---
    this.#move.set(0, 0, 0);

    if (input.isKeyDown("KeyW") || input.isKeyDown("ArrowUp")) {
      this.#move.addScaledVector(this.#forward, 1);
    }
    if (input.isKeyDown("KeyS") || input.isKeyDown("ArrowDown")) {
      this.#move.addScaledVector(this.#forward, -1);
    }
    if (input.isKeyDown("KeyA") || input.isKeyDown("ArrowLeft")) {
      this.#move.addScaledVector(this.#right, -1);
    }
    if (input.isKeyDown("KeyD") || input.isKeyDown("ArrowRight")) {
      this.#move.addScaledVector(this.#right, 1);
    }
    if (input.isKeyDown("Space")) {
      this.#move.y += 1;
    }
    if (input.isKeyDown("ShiftLeft") || input.isKeyDown("ShiftRight")) {
      this.#move.y -= 1;
    }

    if (this.#move.lengthSq() > 0) {
      this.#move.normalize().multiplyScalar(this.#moveSpeed);
      this.#vel.copy(this.#move);
    }

    // Scroll to zoom (dolly along look direction) — Ctrl is reserved for brush size.
    const isCtrl = input.isKeyDown("ControlLeft") || input.isKeyDown("ControlRight");
    if (!isCtrl) {
      if (input.isMouseButtonDown("scrollUp")) {
        this.camera.getWorldDirection(this.#forward);
        this.camera.position.addScaledVector(this.#forward, this.#scrollSpeed);
      }
      if (input.isMouseButtonDown("scrollDown")) {
        this.camera.getWorldDirection(this.#forward);
        this.camera.position.addScaledVector(this.#forward, -this.#scrollSpeed);
      }
    }

    // --- Apply velocity + friction ---
    this.camera.position.addScaledVector(this.#vel, deltaTime);
    this.#vel.lerp(new THREE.Vector3(0, 0, 0), this.#friction);

    // Damp to exact zero when nearly stopped.
    if (this.#vel.lengthSq() < 0.0001) {
      this.#vel.set(0, 0, 0);
    }

    // Handle resize
    const canvas = this.actor.world.renderer.canvas;
    const aspect = canvas.clientWidth / canvas.clientHeight;
    if (Math.abs(this.camera.aspect - aspect) > 0.001) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
  }
}
