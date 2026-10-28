// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { Actor } from "../../../actor/Actor.ts";
import { CameraComponent, type CameraOptions } from "../Camera.ts";
import { OrbitFlyKeys } from "./OrbitFlyKeys.ts";
import { OrbitFlyInput } from "./OrbitFlyInput.ts";
import {
  FlyRig,
  type CameraPose,
  type FlyRigSettings,
  type TouchpadSwipeMode
} from "./FlyRig.ts";
import {
  frameBounds,
  type CameraFramingOptions
} from "./cameraFraming.ts";

export interface OrbitFlyCameraOptions extends CameraOptions, FlyRigSettings {
  /**
   * The keys held to fly and look around.
   * @default OrbitFlyKeys.default
   */
  keys?: OrbitFlyKeys;
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

export class OrbitFlyCamera extends CameraComponent {
  enabled = true;

  #rig: FlyRig;
  #input: OrbitFlyInput;

  constructor(
    actor: Actor,
    options: OrbitFlyCameraOptions = {}
  ) {
    super(actor, {
      ...options,
      fov: options.fov ?? 60,
      far: options.far ?? 2000
    });

    this.#rig = new FlyRig({
      ...options,
      sceneProvider: () => this.actor.world.sceneManager.getSource()
    });
    this.#input = new OrbitFlyInput(options.keys ?? OrbitFlyKeys.default);

    this.addTeardown(() => this.#rig.dispose());
    this.addTeardown(
      this.actor.world.keepAlive(() => this.enabled && this.moving)
    );
    this.#writeBody();
  }

  get camera(): THREE.PerspectiveCamera {
    return this.projection.requirePerspective();
  }

  get moveSpeed(): number {
    return this.#rig.moveSpeed;
  }

  set moveSpeed(
    speed: number
  ) {
    this.#rig.moveSpeed = speed;
  }

  get mouseSensitivity(): number {
    return this.#rig.mouseSensitivity;
  }

  set mouseSensitivity(
    sensitivity: number
  ) {
    this.#rig.mouseSensitivity = sensitivity;
  }

  get touchpadLookSensitivity(): number {
    return this.#rig.touchpadLookSensitivity;
  }

  set touchpadLookSensitivity(
    sensitivity: number
  ) {
    this.#rig.touchpadLookSensitivity = sensitivity;
  }

  get touchpadSwipe(): TouchpadSwipeMode {
    return this.#rig.touchpadSwipe;
  }

  set touchpadSwipe(
    mode: TouchpadSwipeMode
  ) {
    this.#rig.touchpadSwipe = mode;
  }

  get invertY(): boolean {
    return this.#rig.invertY;
  }

  set invertY(
    invertY: boolean
  ) {
    this.#rig.invertY = invertY;
  }

  get keys(): OrbitFlyKeys {
    return this.#input.keys;
  }

  set keys(
    keys: OrbitFlyKeys
  ) {
    this.#input.keys = keys;
  }

  get moving(): boolean {
    return this.#rig.moving;
  }

  get isOrbiting(): boolean {
    return this.#rig.isOrbiting;
  }

  get orbitPivot(): THREE.Vector3Like | null {
    return this.#rig.orbitPivot;
  }

  teleport(
    pose: CameraPose
  ): void {
    this.#rig.teleport(pose);
    this.#writeBody();
    this.actor.world.invalidate();
  }

  enterOrbitFocus(
    point?: THREE.Vector3Like
  ): void {
    if (this.#rig.enterOrbitFocus(point)) {
      this.#writeBody();
      this.actor.world.invalidate();
    }
  }

  exitOrbitFocus(): void {
    this.#rig.exitOrbitFocus();
    this.actor.world.invalidate();
  }

  frame(
    bounds: THREE.Box3,
    options: Partial<CameraFramingOptions> = {}
  ): void {
    this.exitOrbitFocus();
    this.teleport(frameBounds(bounds, {
      forward: this.actor.transform.getForward(new THREE.Vector3()),
      fov: this.settings.fov,
      ...options
    }));
  }

  update() {
    const { input, time } = this.actor.world;

    if (!this.enabled) {
      this.#input.suspend(input);
      this.#rig.halt();

      return;
    }

    this.#rig.step(this.#input.read(input), time.unscaledDelta);
    this.#writeBody();
  }

  #writeBody(): void {
    const { position, orientation } = this.#rig.body;

    this.actor.transform.setLocalOrientation(orientation);
    this.actor.transform.setLocalPosition(position);
  }
}
