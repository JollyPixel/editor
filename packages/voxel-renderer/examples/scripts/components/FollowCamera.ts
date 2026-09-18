// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";

// CONSTANTS
const kSnapDistanceSq = 8 * 8;

export interface FollowCameraOptions {
  target: THREE.Object3D;
  /**
   * Camera position relative to the target.
   * @default { x: 0, y: 5, z: 8 }
   */
  offset?: THREE.Vector3Like;
  /**
   * How fast the camera catches up, per second; higher is tighter.
   * @default 8
   */
  stiffness?: number;
}

export class FollowCamera extends ActorComponent {
  #target: THREE.Object3D;
  #offset: THREE.Vector3;
  #stiffness: number;
  #position = new THREE.Vector3();
  #focus = new THREE.Vector3();
  #goal = new THREE.Vector3();

  constructor(
    actor: Actor<any>,
    options: FollowCameraOptions
  ) {
    super({
      actor,
      typeName: "FollowCamera"
    });

    this.#target = options.target;
    this.#offset = new THREE.Vector3().copy(
      options.offset ?? { x: 0, y: 5, z: 8 }
    );
    this.#stiffness = options.stiffness ?? 8;
  }

  update(
    deltaTime: number
  ): void {
    this.#target.getWorldPosition(this.#goal);

    if (this.#focus.distanceToSquared(this.#goal) > kSnapDistanceSq) {
      this.#focus.copy(this.#goal);
    }
    else {
      const blend = 1 - Math.exp(-this.#stiffness * deltaTime);
      this.#focus.lerp(this.#goal, blend);
    }

    this.#position.copy(this.#focus).add(this.#offset);
    this.actor.transform
      .setLocalPosition(this.#position)
      .lookAt(this.#focus);
  }
}
