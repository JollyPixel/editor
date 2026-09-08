// Import Third-party Dependencies
import * as THREE from "three";
import {
  Actor,
  CameraComponent,
  createViewHelper,
  Axis,
  AxisMap,
  InputCombination,
  type InputCondition
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import { OrbitFocus } from "./OrbitFocus.ts";
import { ElasticFocus } from "./ElasticFocus.ts";

// CONSTANTS
const kRestingVelocitySq = 1e-6;

export type FreeFlyCameraFocusMode = "none" | "lock" | "elastic";

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
   * Frame-rate-independent acceleration and braking rate, in 1/s.
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
  /**
   * "none": no pivot. "lock": `enterOrbitFocus` engages a fixed pivot;
   * scroll adjusts distance, only `exitOrbitFocus` releases it. "elastic":
   * WASD/look pilot a free-floating pivot; scroll trails the camera
   * behind it, reaching 0 (free-fly) at full zoom-in.
   * @default "none"
   */
  focusMode?: FreeFlyCameraFocusMode;
  /**
   * Bounds for the scroll-adjusted pivot distance in "lock" mode; only
   * `maxPivotDistance` applies to "elastic", as its max trail distance.
   */
  minPivotDistance?: number;
  maxPivotDistance?: number;
  /**
   * Distance nudged per key press while orbiting in "lock" mode.
   * @default 1
   */
  pivotNudgeStep?: number;
}

export interface CameraPose {
  position: THREE.Vector3Like;
  quaternion: THREE.QuaternionLike;
}

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
  #orbitFocus: OrbitFocus | null;
  #elasticFocus: ElasticFocus | null;

  // Reused each frame to avoid allocations.
  #forward = new THREE.Vector3();
  #right = new THREE.Vector3();
  #up = new THREE.Vector3(0, 1, 0);
  #move = new THREE.Vector3();
  #offset = new THREE.Vector3();
  #scroll = { x: 0, y: 0 };
  #euler = new THREE.Euler(0, 0, 0, "YXZ");
  #orientation = new THREE.Quaternion();

  #descend: InputCondition = {
    evaluate: (input) => !this.#descendBlocked && (
      input.keyboard.isDown("ShiftLeft") ||
      input.keyboard.isDown("ShiftRight")
    ),
    reset: () => void 0
  };

  #axes = new AxisMap({
    moveRight: Axis.buttons(
      InputCombination.atLeastOne("KeyD.down", "ArrowRight.down"),
      InputCombination.atLeastOne("KeyA.down", "ArrowLeft.down")
    ),
    moveUp: Axis.buttons("Space", this.#descend),
    moveForward: Axis.buttons(
      InputCombination.atLeastOne("KeyW.down", "ArrowUp.down"),
      InputCombination.atLeastOne("KeyS.down", "ArrowDown.down")
    )
  });
  #controls = InputCombination.atLeastOne(
    "ControlLeft.down",
    "ControlRight.down"
  );
  #shift = InputCombination.atLeastOne(
    "ShiftLeft.down",
    "ShiftRight.down"
  );
  #alt = InputCombination.atLeastOne(
    "AltLeft.down",
    "AltRight.down"
  );

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
      pitch = -0.2,
      focusMode = "none",
      minPivotDistance = 1,
      maxPivotDistance = 200,
      pivotNudgeStep = 1
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

    const initialPosition = options.position ?? { x: 16, y: 20, z: 40 };
    this.#orbitFocus = focusMode === "lock" ? new OrbitFocus({
      minPivotDistance,
      maxPivotDistance,
      pivotNudgeStep,
      sceneProvider: () => this.actor.world.sceneManager.getSource()
    }) : null;
    this.#elasticFocus = focusMode === "elastic" ? new ElasticFocus({
      initialPosition,
      maxTrailDistance: maxPivotDistance,
      sceneProvider: () => this.actor.world.sceneManager.getSource()
    }) : null;

    this.#applyOrientation();
    this.actor.transform.setLocalPosition(initialPosition);
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

  teleport(
    pose: CameraPose
  ): void {
    const { x, y, z, w } = pose.quaternion;
    this.#euler.setFromQuaternion(
      this.#orientation.set(x, y, z, w)
    );
    this.#yaw = this.#euler.y;
    this.#pitch = Math.max(
      -this.#maxPitch,
      Math.min(this.#maxPitch, this.#euler.x)
    );
    this.#vel.set(0, 0, 0);

    this.#applyOrientation();
    this.actor.transform.setLocalPosition(pose.position);
  }

  get isOrbiting(): boolean {
    if (this.#orbitFocus) {
      return this.#orbitFocus.isOrbiting;
    }

    return (this.#elasticFocus?.trailDistance ?? 0) > 0;
  }

  get orbitPivot(): THREE.Vector3Like | null {
    return this.#orbitFocus?.pivot ?? this.#elasticFocus?.pivotPosition ?? null;
  }

  enterOrbitFocus(
    point?: THREE.Vector3Like
  ): void {
    if (!this.#orbitFocus) {
      return;
    }

    const { transform } = this.actor;
    const cameraPosition = transform.getGlobalPosition(this.#offset);
    const result = this.#orbitFocus.enter(
      point,
      cameraPosition,
      this.#yaw,
      this.#pitch,
      this.#up
    );
    if (result === false) {
      return;
    }

    this.#yaw = result.yaw;
    this.#pitch = Math.max(
      -this.#maxPitch,
      Math.min(this.#maxPitch, result.pitch)
    );
    this.#vel.set(0, 0, 0);
    this.#orbitFocus.updatePose(transform, this.#yaw, this.#pitch, 0, this.#responsiveness);
  }

  exitOrbitFocus(): void {
    this.#orbitFocus?.exit();
  }

  override destroy(): void {
    this.#orbitFocus?.dispose();
    this.#elasticFocus?.dispose();
    super.destroy();
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
    const isDescending = this.#shift.evaluate(input);

    if (!this.enabled) {
      this.#descendBlocked = isDescending;
      this.#vel.set(0, 0, 0);

      return;
    }
    if (!isDescending) {
      this.#descendBlocked = false;
    }

    const { transform } = this.actor;
    const isLooking = input.mouse.isDown("middle") ||
      (this.#alt.evaluate(input) && input.mouse.isDown("left"));

    if (isLooking && input.mouse.isMoving()) {
      const delta = input.mouse.viewportDelta(false);
      this.#yaw -= delta.x * this.#mouseSensitivity;
      this.#pitch += delta.y * this.#mouseSensitivity;
      this.#pitch = Math.max(
        -this.#maxPitch,
        Math.min(this.#maxPitch, this.#pitch)
      );

      if (!this.#orbitFocus?.isOrbiting) {
        this.#applyOrientation();
      }
    }

    transform.getForward(this.#forward);
    this.#forward.y = 0;
    this.#forward.normalize();
    this.#right.crossVectors(this.#forward, this.#up).normalize();

    this.#axes.update(input);
    this.#move.set(0, 0, 0);
    if (this.#orbitFocus?.isOrbiting) {
      this.#orbitFocus.nudge(input, this.#forward, this.#right);
    }
    else {
      this.#move.addScaledVector(
        this.#forward,
        this.#axes.value("moveForward")
      );
      this.#move.addScaledVector(
        this.#right,
        this.#axes.value("moveRight")
      );
      this.#move.y += this.#axes.value("moveUp");

      if (this.#move.lengthSq() > 0) {
        this.#move.normalize().multiplyScalar(this.#moveSpeed);
      }
    }

    // Ctrl reserves scrolling for brush size.
    const isCtrl = this.#controls.evaluate(input);
    const scroll = input.mouse.scrollTo(this.#scroll);
    if (!isCtrl && scroll.y !== 0) {
      if (this.#elasticFocus) {
        this.#elasticFocus.adjustTrailDistance(-scroll.y * this.#scrollSpeed);
      }
      else {
        const outcome = this.#orbitFocus?.handleScroll(
          scroll.y,
          this.#scrollSpeed
        ) ?? "inactive";

        if (outcome === "inactive") {
          this.moveSpeed = this.#moveSpeed *
            Math.pow(1 + this.#speedAdjustStep, scroll.y);
        }
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
      this.#offset
        .copy(this.#vel)
        .multiplyScalar(deltaTime);
      if (this.#elasticFocus) {
        this.#elasticFocus.move(this.#offset);
      }
      else {
        transform.moveGlobal(this.#offset);
      }
    }

    if (this.#orbitFocus?.isOrbiting) {
      this.#orbitFocus.updatePose(transform, this.#yaw, this.#pitch, deltaTime, this.#responsiveness);
    }
    if (this.#elasticFocus) {
      this.#elasticFocus.updatePose(transform, this.#orientation, deltaTime, this.#responsiveness);
    }
  }
}
