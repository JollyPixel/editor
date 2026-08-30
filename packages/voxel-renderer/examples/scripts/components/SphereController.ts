// Import Third-party Dependencies
import type { RigidBody } from "@dimforge/rapier3d";
import * as THREE from "three/webgpu";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import {
  Interpolated,
  lerpNumber
} from "@jolly-pixel/loop";

export interface SphereBehaviorOptions {
  body: RigidBody;
  mesh: THREE.Mesh;
  /**
   * Impulse magnitude applied per update frame while an arrow key is held.
   * Increase to accelerate faster; the body's linearDamping controls deceleration.
   * @default 0.15
   */
  force?: number;
}

export class SphereBehavior extends ActorComponent {
  #body: RigidBody;
  #mesh: THREE.Mesh;
  #force: number;
  #position = new Interpolated<THREE.Vector3Like>(
    { x: 0, y: 0, z: 0 },
    (previous, current, alpha) => {
      return {
        x: lerpNumber(previous.x, current.x, alpha),
        y: lerpNumber(previous.y, current.y, alpha),
        z: lerpNumber(previous.z, current.z, alpha)
      };
    }
  );

  constructor(
    actor: Actor<any>,
    options: SphereBehaviorOptions
  ) {
    super({
      actor,
      typeName: "SphereBehavior"
    });

    this.#body = options.body;
    this.#mesh = options.mesh;
    this.#force = options.force ?? 0.15;
  }

  fixedUpdate(): void {
    const { input } = this.actor.world;

    let x = 0;
    let z = 0;

    if (input.keyboard.isDown("ArrowLeft")) {
      x -= 1;
    }
    if (input.keyboard.isDown("ArrowRight")) {
      x += 1;
    }
    if (input.keyboard.isDown("ArrowUp")) {
      z -= 1;
    }
    if (input.keyboard.isDown("ArrowDown")) {
      z += 1;
    }

    if (x !== 0 || z !== 0) {
      const len = Math.sqrt(x * x + z * z);
      this.#body.applyImpulse(
        {
          x: (x / len) * this.#force,
          y: 0,
          z: (z / len) * this.#force
        },
        true
      );
    }

    this.#position.push(
      this.#body.translation()
    );
  }

  update(
    _dt: number,
    alpha = 0
  ): void {
    const { x, y, z } = this.#position.at(alpha);

    this.#mesh.position.set(x, y, z);
  }
}
