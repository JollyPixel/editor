// Import Third-party Dependencies
import * as THREE from "three";
import {
  Actor,
  CameraComponent,
  Axis,
  AxisMap,
  InputCombination,
  type InputCondition
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import { ElasticFocus } from "./ElasticFocus.ts";

// CONSTANTS
const kRestingVelocitySq = 1e-6;

export interface FreeFlyCameraOptions {
  position?: THREE.Vector3Like;
  /**
   * Elastic-focus pivot the camera starts trailing behind.
   * @default position
   */
  pivotPosition?: THREE.Vector3Like;
  /**
   * Starting trail distance, in world units.
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
   * Frame-rate-independent acceleration and braking rate, in 1/s.
   */
  responsiveness?: number;
  mouseSensitivity?: number;
  maxPitch?: number;
  /**
   * Units of elastic-focus trail distance adjusted per wheel notch.
   */
  scrollSpeed?: number;
  /**
   * Maximum distance the camera can trail behind the WASD/look-piloted
   * pivot, in world units.
   */
  maxTrailDistance?: number;
}

/**
 * WASD + mouse-look fly camera with an elastic-focus pivot: movement drives
 * a free-floating pivot point rather than the camera directly, and the
 * camera trails behind it at a scroll-adjusted distance. Ported from
 * voxel-map's `src/scene/camera/FreeFlyCamera.ts` (`focusMode: "elastic"`
 * only — the `"lock"`/`OrbitFocus` path is dropped since voxel-model has no
 * use for it), with voxel-model-scale defaults instead of voxel-map's
 * terrain-scale ones.
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
  #elasticFocus: ElasticFocus;

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
      position = { x: 0, y: 1, z: 5 },
      pivotPosition = position,
      initialTrailDistance = 0,
      yaw = 0,
      pitch = -0.2,
      moveSpeed = 6,
      minMoveSpeed = 1,
      maxMoveSpeed = 60,
      responsiveness = 18,
      mouseSensitivity = 0.003,
      maxPitch = Math.PI / 2 - 0.01,
      scrollSpeed = 1,
      maxTrailDistance = 20
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

    this.#elasticFocus = new ElasticFocus({
      initialPosition: pivotPosition,
      maxTrailDistance,
      initialTrailDistance,
      sceneProvider: () => this.actor.world.sceneManager.getSource()
    });

    this.#applyOrientation();
    this.actor.transform.setLocalPosition(position);
  }

  #applyOrientation(): void {
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

  get moveSpeed(): number {
    return this.#moveSpeed;
  }

  set moveSpeed(
    speed: number
  ) {
    this.#moveSpeed = this.#clampMoveSpeed(speed);
  }

  override destroy(): void {
    this.#elasticFocus.dispose();
    super.destroy();
  }

  update(
    deltaTime: number
  ): void {
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
      this.#applyOrientation();
    }

    transform.getForward(this.#forward);
    this.#forward.y = 0;
    this.#forward.normalize();
    this.#right.crossVectors(this.#forward, this.#up).normalize();

    this.#axes.update(input);
    this.#move.set(0, 0, 0);
    this.#move.addScaledVector(this.#forward, this.#axes.value("moveForward"));
    this.#move.addScaledVector(this.#right, this.#axes.value("moveRight"));
    this.#move.y += this.#axes.value("moveUp");

    if (this.#move.lengthSq() > 0) {
      this.#move.normalize().multiplyScalar(this.#moveSpeed);
    }

    // Ctrl reserves scrolling for brush size.
    const isCtrl = this.#controls.evaluate(input);
    const scroll = input.mouse.scrollTo(this.#scroll);
    if (!isCtrl && scroll.y !== 0) {
      this.#elasticFocus.adjustTrailDistance(-scroll.y * this.#scrollSpeed);
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
      this.#elasticFocus.move(this.#offset);
    }

    this.#elasticFocus.updatePose(transform, this.#orientation, deltaTime, this.#responsiveness);
  }
}
