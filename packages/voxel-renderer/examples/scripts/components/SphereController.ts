// Import Third-party Dependencies
import type { RigidBody } from "@dimforge/rapier3d";
import * as THREE from "three";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";

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
 */
export class SphereBehavior extends ActorComponent {
  #body: RigidBody;
  #mesh: THREE.Mesh;
  #force: number;

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

  update(_dt: number): void {
    const { input } = this.actor.world;

    let x = 0;
    let z = 0;

    if (input.isKeyDown("ArrowLeft")) {
      x -= 1;
    }
    if (input.isKeyDown("ArrowRight")) {
      x += 1;
    }
    if (input.isKeyDown("ArrowUp")) {
      z -= 1;
    }
    if (input.isKeyDown("ArrowDown")) {
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

    // Sync the Three.js mesh to the physics body position.
    // update() runs after the last fixed-update batch each frame, so the
    // position read here always reflects the most recent Rapier step.
    const pos = this.#body.translation();
    this.#mesh.position.set(pos.x, pos.y, pos.z);
  }
}
