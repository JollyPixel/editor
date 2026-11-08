// Import Third-party Dependencies
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import { RigidBody } from "@jolly-pixel/physics/engine";

export interface SphereBehaviorOptions {
  force?: number;
}

export class SphereBehavior extends ActorComponent {
  #force: number;

  constructor(
    actor: Actor<any>,
    options: SphereBehaviorOptions = {}
  ) {
    super({
      actor,
      typeName: "SphereBehavior"
    });

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

    const rigidBody = this.actor.findComponent(RigidBody);
    if (rigidBody === null || (x === 0 && z === 0)) {
      return;
    }

    const length = Math.sqrt((x * x) + (z * z));
    rigidBody.body.applyImpulse({
      x: (x / length) * this.#force,
      y: 0,
      z: (z / length) * this.#force
    });
  }
}
