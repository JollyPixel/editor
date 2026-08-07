// Import Third-party Dependencies
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface OrbitControlsBehaviorOptions {
  camera: THREE.Camera;
  cameraActor: Actor;
  /** @default (0, 0, 0) */
  target?: THREE.Vector3;
  /** @default 3 */
  minDistance?: number;
  /** @default 30 */
  maxDistance?: number;
}

/**
 * Damped drag-orbit and scroll-zoom controls.
 */
export class OrbitControlsBehavior extends ActorComponent {
  readonly controls: OrbitControls;
  #cameraActor: Actor;

  constructor(
    actor: Actor,
    options: OrbitControlsBehaviorOptions
  ) {
    super({
      actor,
      typeName: "OrbitControlsBehavior"
    });

    this.#cameraActor = options.cameraActor;

    options.camera.position.copy(
      this.#cameraActor.transform.getLocalPosition()
    );
    options.camera.quaternion.copy(
      this.#cameraActor.transform.getLocalOrientation()
    );

    this.controls = new OrbitControls(
      options.camera,
      actor.world.renderer.canvas
    );
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = options.minDistance ?? 3;
    this.controls.maxDistance = options.maxDistance ?? 30;
    if (options.target) {
      this.controls.target.copy(options.target);
    }
    this.controls.update();
    this.#writebackPose();
  }

  update(): void {
    this.controls.update();
    this.#writebackPose();
  }

  #writebackPose(): void {
    const { object } = this.controls;

    this.#cameraActor.transform.setLocalPosition(
      object.position
    );
    this.#cameraActor.transform.setLocalOrientation(
      object.quaternion
    );
  }

  override destroy(): void {
    this.controls.dispose();
    super.destroy();
  }
}
