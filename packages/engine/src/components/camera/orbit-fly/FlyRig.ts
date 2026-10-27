// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { OrbitFocus } from "./OrbitFocus.ts";
import { ElasticFocus } from "./ElasticFocus.ts";
import { SmoothedVelocity } from "./SmoothedVelocity.ts";
import {
  type CameraFocus,
  type FlyBody,
  type OrbitFlyNudge,
  NoCameraFocus
} from "./CameraFocus.ts";

// CONSTANTS
export const TOUCHPAD_SWIPE_MODES = ["look", "pan"] as const;
const kPanPerNotch = 0.05;

export type TouchpadSwipeMode = typeof TOUCHPAD_SWIPE_MODES[number];
export type OrbitFlyCameraFocusMode = "none" | "lock" | "elastic";

export interface FlyIntent {
  move: {
    right: number;
    up: number;
    forward: number;
  };
  look: {
    right: number;
    up: number;
  };
  drag: THREE.Vector2Like;
  swipe: THREE.Vector2Like | null;
  wheel: number;
  nudge: OrbitFlyNudge | null;
}

export interface CameraPose {
  position: THREE.Vector3Like;
  quaternion: THREE.QuaternionLike;
}

export interface FlyRigSettings {
  position?: THREE.Vector3Like;
  /**
   * "elastic" mode's pivot the camera starts trailing behind.
   * @default position
   */
  pivotPosition?: THREE.Vector3Like;
  /**
   * "elastic" mode's starting trail distance, in world units.
   * @default 0
   */
  initialTrailDistance?: number;
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
   * Seconds to ease into a new cruise velocity; 0 starts at full speed.
   * @default 0.15
   */
  accelerationTime?: number;
  /**
   * Seconds to glide to a stop once movement keys are released; 0 stops
   * at once.
   * @default 0.1
   */
  brakingTime?: number;
  /**
   * Frame-rate-independent damping rate of the pivot and trail distance,
   * in 1/s.
   */
  responsiveness?: number;
  mouseSensitivity?: number;
  /**
   * Radians turned per wheel notch of a two-finger touchpad swipe.
   * @default 0.36
   */
  touchpadLookSensitivity?: number;
  /**
   * What a two-finger touchpad swipe does: "look" turns the camera, "pan"
   * moves it sideways and up or down, a twentieth of `moveSpeed` per notch.
   * While orbiting a "lock" pivot, a swipe always orbits.
   * @default "look"
   */
  touchpadSwipe?: TouchpadSwipeMode;
  /**
   * Turns the camera down when the mouse or the fingers move up.
   * @default false
   */
  invertY?: boolean;
  /**
   * Radians per second turned while a look key is held.
   * @default Math.PI / 2
   */
  keyLookSpeed?: number;
  maxPitch?: number;
  /**
   * "elastic" mode's trail distance changed per wheel notch, in world units.
   */
  scrollSpeed?: number;
  /**
   * Fraction `moveSpeed` grows per wheel notch when scroll is not
   * adjusting a pivot distance.
   */
  speedAdjustStep?: number;
  /**
   * "none": no pivot. "lock": `enterOrbitFocus` engages a fixed pivot;
   * scroll adjusts distance, only `exitOrbitFocus` releases it. "elastic":
   * WASD/look pilot a free-floating pivot; scroll trails the camera
   * behind it, reaching 0 (free-fly) at full zoom-in.
   * @default "none"
   */
  focusMode?: OrbitFlyCameraFocusMode;
  /**
   * Bounds for the scroll-adjusted pivot distance in "lock" mode; the min
   * must be greater than 0. The max doubles as "elastic" mode's max trail.
   */
  minPivotDistance?: number;
  maxPivotDistance?: number;
  /**
   * Per wheel notch, the "lock" pivot distance is multiplied by
   * `1 + pivotZoomStep` zooming out and divided by it zooming in.
   * @default 0.1
   */
  pivotZoomStep?: number;
  /**
   * Distance nudged per key press while orbiting in "lock" mode.
   * @default 1
   */
  pivotNudgeStep?: number;
  /**
   * @default true
   */
  showPivotMarker?: boolean;
}

export interface FlyRigOptions extends FlyRigSettings {
  sceneProvider: () => THREE.Object3D;
}

export class FlyRig {
  readonly body: FlyBody = {
    position: new THREE.Vector3(),
    orientation: new THREE.Quaternion()
  };

  mouseSensitivity: number;
  touchpadLookSensitivity: number;
  touchpadSwipe: TouchpadSwipeMode;
  invertY: boolean;

  #velocity: SmoothedVelocity;
  #focus: CameraFocus;
  #yaw: number;
  #pitch: number;
  #moveSpeed: number;
  #minMoveSpeed: number;
  #maxMoveSpeed: number;
  #responsiveness: number;
  #keyLookSpeed: number;
  #maxPitch: number;
  #speedAdjustStep: number;

  #forward = new THREE.Vector3();
  #right = new THREE.Vector3();
  #up = new THREE.Vector3(0, 1, 0);
  #move = new THREE.Vector3();
  #offset = new THREE.Vector3();
  #euler = new THREE.Euler(0, 0, 0, "YXZ");

  constructor(
    options: FlyRigOptions
  ) {
    const {
      position = { x: 16, y: 20, z: 40 },
      pivotPosition = position,
      initialTrailDistance = 0,
      yaw = 0,
      pitch = -0.2,
      moveSpeed = 18,
      minMoveSpeed = 2,
      maxMoveSpeed = 240,
      accelerationTime = 0.15,
      brakingTime = 0.1,
      responsiveness = 18,
      mouseSensitivity = 0.003,
      touchpadLookSensitivity = 0.36,
      touchpadSwipe = "look",
      invertY = false,
      keyLookSpeed = Math.PI / 2,
      maxPitch = Math.PI / 2 - 0.01,
      scrollSpeed = 2.5,
      speedAdjustStep = 0.15,
      focusMode = "none",
      minPivotDistance = 1,
      maxPivotDistance = 200,
      pivotZoomStep = 0.1,
      pivotNudgeStep = 1,
      showPivotMarker = true,
      sceneProvider
    } = options;

    this.mouseSensitivity = mouseSensitivity;
    this.touchpadLookSensitivity = touchpadLookSensitivity;
    this.touchpadSwipe = touchpadSwipe;
    this.invertY = invertY;

    this.#yaw = yaw;
    this.#pitch = pitch;
    this.#minMoveSpeed = minMoveSpeed;
    this.#maxMoveSpeed = maxMoveSpeed;
    this.#moveSpeed = this.#clampMoveSpeed(moveSpeed);
    this.#velocity = new SmoothedVelocity({
      accelerationTime,
      brakingTime
    });
    this.#responsiveness = responsiveness;
    this.#keyLookSpeed = keyLookSpeed;
    this.#maxPitch = maxPitch;
    this.#speedAdjustStep = speedAdjustStep;

    switch (focusMode) {
      case "lock":
        this.#focus = new OrbitFocus({
          minPivotDistance,
          maxPivotDistance,
          pivotZoomStep,
          pivotNudgeStep,
          showPivotMarker,
          sceneProvider
        });
        break;
      case "elastic":
        this.#focus = new ElasticFocus({
          initialPosition: pivotPosition,
          maxTrailDistance: maxPivotDistance,
          trailScrollStep: scrollSpeed,
          initialTrailDistance,
          showPivotMarker,
          sceneProvider
        });
        break;
      default:
        this.#focus = new NoCameraFocus();
    }

    this.#orientFromAngles();
    this.body.position.copy(position);
  }

  get moveSpeed(): number {
    return this.#moveSpeed;
  }

  set moveSpeed(
    speed: number
  ) {
    this.#moveSpeed = this.#clampMoveSpeed(speed);
  }

  get moving(): boolean {
    return !this.#velocity.resting || !this.#focus.settled;
  }

  get isOrbiting(): boolean {
    return this.#focus.isOrbiting;
  }

  get orbitPivot(): THREE.Vector3Like | null {
    return this.#focus.pivot;
  }

  halt(): void {
    this.#velocity.stop();
  }

  step(
    intent: FlyIntent,
    deltaTime: number
  ): void {
    const pan = intent.swipe !== null &&
      this.touchpadSwipe === "pan" &&
      !this.#focus.isLocked ? intent.swipe : null;

    this.#look(intent, pan === null ? intent.swipe : null, deltaTime);

    this.#forward.set(0, 0, -1).applyQuaternion(this.body.orientation);
    this.#forward.y = 0;
    this.#forward.normalize();
    this.#right.crossVectors(this.#forward, this.#up).normalize();

    this.#move.set(0, 0, 0);
    if (this.#focus.isLocked) {
      if (intent.nudge !== null) {
        this.#focus.nudge(intent.nudge, this.#forward, this.#right);
      }
    }
    else {
      this.#move
        .addScaledVector(this.#forward, intent.move.forward)
        .addScaledVector(this.#right, intent.move.right);
      this.#move.y += intent.move.up;

      if (this.#move.lengthSq() > 0) {
        this.#move.normalize().multiplyScalar(this.#moveSpeed);
      }
    }

    if (
      intent.wheel !== 0 &&
      !this.#focus.handleScroll(intent.wheel)
    ) {
      this.moveSpeed = this.#moveSpeed *
        Math.pow(1 + this.#speedAdjustStep, intent.wheel);
    }

    this.#velocity.approach(this.#move, deltaTime);
    if (!this.#velocity.resting) {
      this.#focus.move(
        this.#offset.copy(this.#velocity.value).multiplyScalar(deltaTime),
        this.body
      );
    }
    if (pan !== null && (pan.x !== 0 || pan.y !== 0)) {
      const step = this.#moveSpeed * kPanPerNotch;
      this.#offset
        .copy(this.#right)
        .multiplyScalar(-pan.x * step)
        .addScaledVector(this.#up, -pan.y * step);
      this.#focus.move(this.#offset, this.body);
    }

    this.#updateFocusPose(deltaTime);
  }

  teleport(
    pose: CameraPose
  ): void {
    const { x, y, z, w } = pose.quaternion;
    this.#euler.setFromQuaternion(
      this.body.orientation.set(x, y, z, w)
    );
    this.#yaw = this.#euler.y;
    this.#pitch = this.#clampPitch(this.#euler.x);
    this.#velocity.stop();

    this.#orientFromAngles();
    this.#focus.teleported(pose.position, this.body.orientation);
    this.body.position.copy(pose.position);
  }

  enterOrbitFocus(
    point?: THREE.Vector3Like
  ): boolean {
    const orientation = this.#focus.enter({
      point,
      cameraPosition: this.body.position,
      yaw: this.#yaw,
      pitch: this.#pitch,
      up: this.#up
    });
    if (orientation === null) {
      return false;
    }

    this.#yaw = orientation.yaw;
    this.#pitch = this.#clampPitch(orientation.pitch);
    this.#velocity.stop();
    this.#updateFocusPose(0);

    return true;
  }

  exitOrbitFocus(): void {
    this.#focus.exit();
  }

  dispose(): void {
    this.#focus.dispose();
  }

  #look(
    intent: FlyIntent,
    swipe: THREE.Vector2Like | null,
    deltaTime: number
  ): void {
    const keyTurn = this.#keyLookSpeed * deltaTime;
    const pitchSign = this.invertY ? -1 : 1;
    let yawDelta = -intent.look.right * keyTurn;
    let pitchDelta = intent.look.up * keyTurn;

    yawDelta -= intent.drag.x * this.mouseSensitivity;
    pitchDelta += pitchSign * intent.drag.y * this.mouseSensitivity;
    if (swipe !== null) {
      yawDelta += swipe.x * this.touchpadLookSensitivity;
      pitchDelta -= pitchSign * swipe.y * this.touchpadLookSensitivity;
    }
    if (yawDelta === 0 && pitchDelta === 0) {
      return;
    }

    this.#yaw += yawDelta;
    this.#pitch = this.#clampPitch(this.#pitch + pitchDelta);

    if (!this.#focus.isLocked) {
      this.#orientFromAngles();
    }
  }

  #orientFromAngles(): void {
    this.body.orientation.setFromEuler(
      this.#euler.set(this.#pitch, this.#yaw, 0)
    );
  }

  #updateFocusPose(
    deltaTime: number
  ): void {
    this.#focus.updatePose({
      body: this.body,
      yaw: this.#yaw,
      pitch: this.#pitch,
      deltaTime,
      responsiveness: this.#responsiveness
    });
  }

  #clampPitch(
    pitch: number
  ): number {
    return THREE.MathUtils.clamp(pitch, -this.#maxPitch, this.#maxPitch);
  }

  #clampMoveSpeed(
    speed: number
  ): number {
    return Math.min(
      this.#maxMoveSpeed,
      Math.max(this.#minMoveSpeed, speed)
    );
  }
}
