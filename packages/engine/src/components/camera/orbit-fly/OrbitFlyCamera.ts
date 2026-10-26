// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  Axis,
  AxisMap,
  InputCombination,
  type InputCondition
} from "@jolly-pixel/controls";

// Import Internal Dependencies
import type { Actor } from "../../../actor/Actor.ts";
import { CameraComponent, type CameraOptions } from "../Camera.ts";
import { OrbitFocus } from "./OrbitFocus.ts";
import { ElasticFocus } from "./ElasticFocus.ts";
import { SmoothedVelocity } from "./SmoothedVelocity.ts";
import { OrbitFlyKeys } from "./OrbitFlyKeys.ts";
import {
  frameBounds,
  type CameraFramingOptions
} from "./cameraFraming.ts";
import {
  type CameraFocus,
  type CameraFocusInput,
  NoCameraFocus
} from "./CameraFocus.ts";

// CONSTANTS
export const TOUCHPAD_SWIPE_MODES = ["look", "pan"] as const;
const kPanPerNotch = 0.05;

export type TouchpadSwipeMode = typeof TOUCHPAD_SWIPE_MODES[number];

type OrbitFlyAxis =
  | "moveRight"
  | "moveUp"
  | "moveForward"
  | "lookRight"
  | "lookUp";

export type OrbitFlyCameraFocusMode = "none" | "lock" | "elastic";

export interface OrbitFlyCameraOptions extends CameraOptions {
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
  /**
   * The keys held to fly and look around.
   * @default OrbitFlyKeys.default
   */
  keys?: OrbitFlyKeys;
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
  /**
   * Vertical field of view, in degrees.
   * @default 60
   */
  fov?: number;
  /**
   * Far clipping plane.
   * @default 2000
   */
  far?: number;
}

export interface CameraPose {
  position: THREE.Vector3Like;
  quaternion: THREE.QuaternionLike;
}

export class OrbitFlyCamera extends CameraComponent {
  enabled = true;

  #descendBlocked = false;
  #velocity: SmoothedVelocity;
  #yaw: number;
  #pitch: number;
  #moveSpeed: number;
  #minMoveSpeed: number;
  #maxMoveSpeed: number;
  #responsiveness: number;
  #mouseSensitivity: number;
  #touchpadLookSensitivity: number;
  #touchpadSwipe: TouchpadSwipeMode;
  #invertY: boolean;
  #keyLookSpeed: number;
  #maxPitch: number;
  #speedAdjustStep: number;
  #focus: CameraFocus;
  #keys: OrbitFlyKeys;
  #axes: AxisMap<OrbitFlyAxis>;

  #forward = new THREE.Vector3();
  #right = new THREE.Vector3();
  #up = new THREE.Vector3(0, 1, 0);
  #move = new THREE.Vector3();
  #offset = new THREE.Vector3();
  #pan = new THREE.Vector3();
  #scroll = { x: 0, y: 0 };
  #euler = new THREE.Euler(0, 0, 0, "YXZ");
  #orientation = new THREE.Quaternion();

  #descend: InputCondition = {
    evaluate: (input) => !this.#descendBlocked &&
      this.#keys.held("down").evaluate(input),
    reset: () => void 0
  };

  constructor(
    actor: Actor,
    options: OrbitFlyCameraOptions = {}
  ) {
    super(actor, {
      ...options,
      fov: options.fov ?? 60,
      far: options.far ?? 2000
    });

    const {
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
      yaw = 0,
      pitch = -0.2,
      focusMode = "none",
      minPivotDistance = 1,
      maxPivotDistance = 200,
      pivotZoomStep = 0.1,
      pivotNudgeStep = 1,
      initialTrailDistance = 0,
      showPivotMarker = true,
      keys = OrbitFlyKeys.default
    } = options;

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
    this.#mouseSensitivity = mouseSensitivity;
    this.#touchpadLookSensitivity = touchpadLookSensitivity;
    this.#touchpadSwipe = touchpadSwipe;
    this.#invertY = invertY;
    this.#keyLookSpeed = keyLookSpeed;
    this.#maxPitch = maxPitch;
    this.#speedAdjustStep = speedAdjustStep;
    this.#keys = keys;
    this.#axes = this.#bindAxes();

    const initialPosition = options.position ?? { x: 16, y: 20, z: 40 };
    const sceneProvider = () => this.actor.world.sceneManager.getSource();
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
          initialPosition: options.pivotPosition ?? initialPosition,
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
    this.addTeardown(() => this.#focus.dispose());
    this.addTeardown(
      this.actor.world.keepAlive(() => this.enabled && this.moving)
    );

    this.#applyOrientation();
    this.actor.transform.setLocalPosition(initialPosition);
  }

  #bindAxes(): AxisMap<OrbitFlyAxis> {
    const keys = this.#keys;

    return new AxisMap({
      moveRight: Axis.buttons(keys.held("right"), keys.held("left")),
      moveUp: Axis.buttons(keys.held("up"), this.#descend),
      moveForward: Axis.buttons(keys.held("forward"), keys.held("back")),
      lookRight: Axis.buttons(keys.held("lookRight"), keys.held("lookLeft")),
      lookUp: Axis.buttons(keys.held("lookUp"), keys.held("lookDown"))
    });
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

  #look(
    input: CameraFocusInput,
    swipe: Readonly<THREE.Vector2Like> | null,
    deltaTime: number
  ): void {
    const keyTurn = this.#keyLookSpeed * deltaTime;
    let yawDelta = -this.#axes.value("lookRight") * keyTurn;
    let pitchDelta = this.#axes.value("lookUp") * keyTurn;

    const pitchSign = this.#invertY ? -1 : 1;
    const isDragging = input.mouse.isDown("middle") ||
      (InputCombination.Alt.evaluate(input) && input.mouse.isDown("left"));
    if (isDragging && input.mouse.isMoving()) {
      const delta = input.mouse.viewportDelta(false);
      yawDelta -= delta.x * this.#mouseSensitivity;
      pitchDelta += pitchSign * delta.y * this.#mouseSensitivity;
    }
    if (swipe !== null) {
      yawDelta += swipe.x * this.#touchpadLookSensitivity;
      pitchDelta -= pitchSign * swipe.y * this.#touchpadLookSensitivity;
    }
    if (yawDelta === 0 && pitchDelta === 0) {
      return;
    }

    this.#yaw += yawDelta;
    this.#pitch = this.#clampPitch(this.#pitch + pitchDelta);

    if (!this.#focus.isLocked) {
      this.#applyOrientation();
    }
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

  get mouseSensitivity(): number {
    return this.#mouseSensitivity;
  }

  set mouseSensitivity(
    sensitivity: number
  ) {
    this.#mouseSensitivity = sensitivity;
  }

  get touchpadLookSensitivity(): number {
    return this.#touchpadLookSensitivity;
  }

  set touchpadLookSensitivity(
    sensitivity: number
  ) {
    this.#touchpadLookSensitivity = sensitivity;
  }

  get touchpadSwipe(): TouchpadSwipeMode {
    return this.#touchpadSwipe;
  }

  set touchpadSwipe(
    mode: TouchpadSwipeMode
  ) {
    this.#touchpadSwipe = mode;
  }

  get invertY(): boolean {
    return this.#invertY;
  }

  set invertY(
    invertY: boolean
  ) {
    this.#invertY = invertY;
  }

  get keys(): OrbitFlyKeys {
    return this.#keys;
  }

  set keys(
    keys: OrbitFlyKeys
  ) {
    this.#keys = keys;
    this.#axes = this.#bindAxes();
  }

  get moving(): boolean {
    return !this.#velocity.resting || !this.#focus.settled;
  }

  teleport(
    pose: CameraPose
  ): void {
    const { x, y, z, w } = pose.quaternion;
    this.#euler.setFromQuaternion(
      this.#orientation.set(x, y, z, w)
    );
    this.#yaw = this.#euler.y;
    this.#pitch = this.#clampPitch(this.#euler.x);
    this.#velocity.stop();

    this.#applyOrientation();
    this.#focus.teleported(pose.position, this.#orientation);
    this.actor.transform.setLocalPosition(pose.position);
    this.actor.world.invalidate();
  }

  get isOrbiting(): boolean {
    return this.#focus.isOrbiting;
  }

  get orbitPivot(): THREE.Vector3Like | null {
    return this.#focus.pivot;
  }

  enterOrbitFocus(
    point?: THREE.Vector3Like
  ): void {
    const { transform } = this.actor;
    const orientation = this.#focus.enter({
      point,
      cameraPosition: transform.getGlobalPosition(this.#offset),
      yaw: this.#yaw,
      pitch: this.#pitch,
      up: this.#up
    });
    if (orientation === null) {
      return;
    }

    this.#yaw = orientation.yaw;
    this.#pitch = this.#clampPitch(orientation.pitch);
    this.#velocity.stop();
    this.#updateFocusPose(0);
    this.actor.world.invalidate();
  }

  exitOrbitFocus(): void {
    this.#focus.exit();
    this.actor.world.invalidate();
  }

  frame(
    bounds: THREE.Box3,
    options: Partial<CameraFramingOptions> = {}
  ): void {
    this.exitOrbitFocus();
    this.teleport(frameBounds(bounds, {
      forward: this.actor.transform.getForward(new THREE.Vector3()),
      fov: this.fov,
      ...options
    }));
  }

  #updateFocusPose(
    deltaTime: number
  ): void {
    this.#focus.updatePose({
      transform: this.actor.transform,
      yaw: this.#yaw,
      pitch: this.#pitch,
      orientation: this.#orientation,
      deltaTime,
      responsiveness: this.#responsiveness
    });
  }

  update() {
    const { input, time } = this.actor.world;
    const deltaTime = time.unscaledDelta;
    const isDescending = this.#keys.held("down").evaluate(input);

    if (!this.enabled) {
      this.#descendBlocked = isDescending;
      this.#velocity.stop();

      return;
    }
    if (!isDescending) {
      this.#descendBlocked = false;
    }

    const isCtrl = InputCombination.Control.evaluate(input);
    const scroll = input.mouse.scrollTo(this.#scroll);
    const isSwiping = !isCtrl && input.mouse.scrollSource === "touchpad";
    const wheel = isCtrl || isSwiping ? 0 : scroll.y;

    const isPanning = isSwiping &&
      this.#touchpadSwipe === "pan" &&
      !this.#focus.isLocked;

    this.#axes.update(input);
    this.#look(input, isSwiping && !isPanning ? scroll : null, deltaTime);

    const { transform } = this.actor;
    transform.getForward(this.#forward);
    this.#forward.y = 0;
    this.#forward.normalize();
    this.#right.crossVectors(this.#forward, this.#up).normalize();

    this.#move.set(0, 0, 0);
    if (this.#focus.isLocked) {
      this.#focus.nudge(input, this.#keys, this.#forward, this.#right);
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

    if (
      wheel !== 0 &&
      !this.#focus.handleScroll(wheel)
    ) {
      this.moveSpeed = this.#moveSpeed *
        Math.pow(1 + this.#speedAdjustStep, wheel);
    }

    this.#velocity.approach(this.#move, deltaTime);
    if (!this.#velocity.resting) {
      this.#focus.move(
        this.#offset.copy(this.#velocity.value).multiplyScalar(deltaTime),
        transform
      );
    }
    if (isPanning && (scroll.x !== 0 || scroll.y !== 0)) {
      const step = this.#moveSpeed * kPanPerNotch;
      this.#pan
        .copy(this.#right)
        .multiplyScalar(-scroll.x * step)
        .addScaledVector(this.#up, -scroll.y * step);
      this.#focus.move(this.#pan, transform);
    }

    this.#updateFocusPose(deltaTime);
  }
}
