// Import Third-party Dependencies
import type { RigidBody } from "@dimforge/rapier3d";
import * as THREE from "three/webgpu";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import { Interpolated, lerpNumber } from "@jolly-pixel/loop";

interface Translation {
  x: number;
  y: number;
  z: number;
}

function lerpTranslation(
  previous: Translation,
  current: Translation,
  alpha: number
): Translation {
  return {
    x: lerpNumber(previous.x, current.x, alpha),
    y: lerpNumber(previous.y, current.y, alpha),
    z: lerpNumber(previous.z, current.z, alpha)
  };
}

export interface SphereBehaviorOptions {
  /** Rapier dynamic body representing the sphere. */
  body: RigidBody;
  /** Three.js mesh to sync with the physics body each frame. */
  mesh: THREE.Mesh;
  /**
   * Impulse magnitude applied per update frame while an arrow key is held.
   * Increase to accelerate faster; the body's linearDamping controls deceleration.
   * @default 0.15
   */
  force?: number;
}

/**
 * ActorComponent that drives a Rapier sphere rigid body with arrow-key input
 * and keeps a Three.js mesh in sync with the simulated body position.
 *
 * Arrow keys map to world-space axes:
 *   ArrowUp / ArrowDown  → -Z / +Z
 *   ArrowLeft / ArrowRight → -X / +X
 *
 * Diagonal input is normalised so all directions have equal force magnitude.
 * The component registers for per-frame updates automatically because it
 * defines an update() method (the engine detects this in Actor.#initializeComponent).
 *
 * Motion lives in fixedUpdate(), which is what fixed steps are for: the
 * simulation advances at a constant rate whatever the display does. update()
 * only draws, interpolating between the last two steps with the frame's alpha
 * so a 60Hz simulation stays smooth on a 144Hz screen.
 */
export class SphereBehavior extends ActorComponent {
  #body: RigidBody;
  #mesh: THREE.Mesh;
  #force: number;
  #position = new Interpolated<Translation>(
    { x: 0, y: 0, z: 0 },
    lerpTranslation
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
      // Normalise diagonal movement so diagonal speed equals cardinal speed.
      const len = Math.sqrt(x * x + z * z);
      this.#body.applyImpulse(
        { x: (x / len) * this.#force, y: 0, z: (z / len) * this.#force },
        true
      );
    }

    // The Rapier step for this tick already ran (world "beforeFixedUpdate"),
    // so this is the body's position as of the step just taken.
    this.#position.push(this.#body.translation());
  }

  update(
    _dt: number,
    alpha = 0
  ): void {
    const { x, y, z } = this.#position.at(alpha);
    this.#mesh.position.set(x, y, z);
  }
}
