// Import Third-party Dependencies
import * as THREE from "three";
import {
  Actor,
  CameraComponent,
  createViewHelper
} from "@jolly-pixel/engine";

// CONSTANTS
const kRestingVelocitySq = 1e-6;

export interface FreeFlyCameraOptions {
  position?: THREE.Vector3Like;
  yaw?: number;
  pitch?: number;
  /**
   * Cruise speed in units per second.
   */
  moveSpeed?: number;
  /**
   * Bounds for the scroll-adjusted `moveSpeed`, in units per second.
   */
  minMoveSpeed?: number;
  maxMoveSpeed?: number;
  /**
   * Velocity response in 1/s: the rate at which the camera eases towards the
   * speed the keys ask for, and back to rest when they are released. Applied
   * against the frame delta, so the feel does not change with frame rate.
   */
  responsiveness?: number;
  mouseSensitivity?: number;
  maxPitch?: number;
  /**
   * Units travelled per wheel notch.
   */
  scrollSpeed?: number;
  /**
   * Fraction `moveSpeed` grows per wheel notch while looking around.
   */
  speedAdjustStep?: number;
}

/**
 * Minecraft-style free-fly camera.
 * WASD = horizontal, Space/Shift = vertical, MMB+drag = look.
 * Wheel dollies along the view; wheel while looking sets the fly speed.
 */
export class FreeFlyCamera extends CameraComponent {
  enabled = true;

  #descendBlocked = false;
  #vel = new THREE.Vector3();
  #yaw: number;
  #pitch: number;
  #moveSpeed: number;
  #minMoveSpeed: number;
  #maxMoveSpeed: number;
  #responsiveness: number;
  #mouseSensitivity: number;
  #maxPitch: number;
  #scrollSpeed: number;
  #speedAdjustStep: number;

  // Reused each frame to avoid allocations.
  #forward = new THREE.Vector3();
  #right = new THREE.Vector3();
  #up = new THREE.Vector3(0, 1, 0);
  #move = new THREE.Vector3();
  #offset = new THREE.Vector3();
  #dollyOffset = new THREE.Vector3();
  #scroll = { x: 0, y: 0 };
  #euler = new THREE.Euler(0, 0, 0, "YXZ");
  #orientation = new THREE.Quaternion();

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
      moveSpeed = 18,
      minMoveSpeed = 2,
      maxMoveSpeed = 240,
      responsiveness = 18,
      mouseSensitivity = 0.003,
      maxPitch = Math.PI / 2 - 0.01,
      scrollSpeed = 2.5,
      speedAdjustStep = 0.15,
      yaw = 0,
      pitch = -0.2
    } = options;

    this.#yaw = yaw;
    this.#pitch = pitch;
    this.#minMoveSpeed = minMoveSpeed;
    this.#maxMoveSpeed = maxMoveSpeed;
    this.#moveSpeed = this.#clampMoveSpeed(moveSpeed);
    this.#responsiveness = responsiveness;
    this.#mouseSensitivity = mouseSensitivity;
    this.#maxPitch = maxPitch;
    this.#scrollSpeed = scrollSpeed;
    this.#speedAdjustStep = speedAdjustStep;

    this.#applyOrientation();
    this.actor.transform.setLocalPosition(
      options.position ?? { x: 16, y: 20, z: 40 }
    );
  }

  #applyOrientation() {
    this.actor.transform.setLocalOrientation(
      this.#orientation.setFromEuler(
        this.#euler.set(
          this.#pitch,
          this.#yaw,
          0
        )
      )
    );
  }

  #dolly(
    transform: Actor["transform"],
    distance: number
  ) {
    transform.moveGlobal(
      transform.getForward(this.#dollyOffset)
        .multiplyScalar(distance)
    );
  }

  #clampMoveSpeed(
    speed: number
  ): number {
    return Math.min(
      this.#maxMoveSpeed,
      Math.max(this.#minMoveSpeed, speed)
    );
  }

  get camera() {
    return this.threeCamera as THREE.PerspectiveCamera;
  }

  get moveSpeed(): number {
    return this.#moveSpeed;
  }

  set moveSpeed(
    speed: number
  ) {
    this.#moveSpeed = this.#clampMoveSpeed(speed);
  }

  start() {
    createViewHelper(
      this.threeCamera,
      this.actor.world
    );
  }

  update(
    deltaTime: number
  ) {
    const { input } = this.actor.world;
    const isDescending = input.keyboard.isDown("ShiftLeft") ||
      input.keyboard.isDown("ShiftRight");

    if (!this.enabled) {
      this.#descendBlocked = isDescending;
      this.#vel.set(0, 0, 0);

      return;
    }
    if (!isDescending) {
      this.#descendBlocked = false;
    }

    const { transform } = this.actor;
    const isLooking = input.mouse.isDown("middle");

    if (isLooking && input.mouse.isMoving()) {
      const delta = input.mouse.viewportDelta(false);
      this.#yaw -= delta.x * this.#mouseSensitivity;
      this.#pitch += delta.y * this.#mouseSensitivity;
      this.#pitch = Math.max(
        -this.#maxPitch,
        Math.min(this.#maxPitch, this.#pitch)
      );

      this.#applyOrientation();
    }

    transform.getForward(this.#forward);
    this.#forward.y = 0;
    this.#forward.normalize();
    this.#right.crossVectors(this.#forward, this.#up).normalize();

    this.#move.set(0, 0, 0);

    if (
      input.keyboard.isDown("KeyW") ||
      input.keyboard.isDown("ArrowUp")
    ) {
      this.#move.addScaledVector(this.#forward, 1);
    }
    if (
      input.keyboard.isDown("KeyS") ||
      input.keyboard.isDown("ArrowDown")
    ) {
      this.#move.addScaledVector(this.#forward, -1);
    }
    if (
      input.keyboard.isDown("KeyA") ||
      input.keyboard.isDown("ArrowLeft")
    ) {
      this.#move.addScaledVector(this.#right, -1);
    }
    if (
      input.keyboard.isDown("KeyD") ||
      input.keyboard.isDown("ArrowRight")
    ) {
      this.#move.addScaledVector(this.#right, 1);
    }
    if (input.keyboard.isDown("Space")) {
      this.#move.y += 1;
    }
    if (isDescending && !this.#descendBlocked) {
      this.#move.y -= 1;
    }

    if (this.#move.lengthSq() > 0) {
      this.#move.normalize().multiplyScalar(this.#moveSpeed);
    }

    // Ctrl reserves scrolling for brush size.
    const isCtrl = input.keyboard.isDown("ControlLeft") || input.keyboard.isDown("ControlRight");
    const scroll = input.mouse.scrollTo(this.#scroll);
    if (!isCtrl && scroll.y !== 0) {
      if (isLooking) {
        this.moveSpeed = this.#moveSpeed *
          Math.pow(1 + this.#speedAdjustStep, scroll.y);
      }
      else {
        this.#dolly(
          transform,
          scroll.y * this.#scrollSpeed
        );
      }
    }

    this.#vel.lerp(
      this.#move,
      1 - Math.exp(-this.#responsiveness * deltaTime)
    );

    if (this.#vel.lengthSq() < kRestingVelocitySq) {
      this.#vel.set(0, 0, 0);
    }
    else {
      transform.moveGlobal(
        this.#offset
          .copy(this.#vel)
          .multiplyScalar(deltaTime)
      );
    }
  }
}
