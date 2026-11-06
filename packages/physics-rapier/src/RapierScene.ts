// Import Third-party Dependencies
import type RAPIER from "@dimforge/rapier3d-compat";

// Import Internal Dependencies
import type { RapierBody } from "./RapierBody.ts";
import type { RapierCollider } from "./RapierCollider.ts";

export class RapierScene {
  readonly world: RAPIER.World;

  #colliders = new Map<number, RapierCollider>();
  #bodies = new Map<RapierBody, Set<RapierCollider>>();
  #forced = new Set<RapierBody>();

  constructor(
    world: RAPIER.World
  ) {
    this.world = world;
  }

  collider(
    handle: number
  ): RapierCollider | undefined {
    return this.#colliders.get(handle);
  }

  addBody(
    body: RapierBody
  ): void {
    this.#bodies.set(
      body,
      new Set()
    );
  }

  hasBody(
    body: RapierBody
  ): boolean {
    return this.#bodies.has(body);
  }

  removeBody(
    body: RapierBody
  ): void {
    for (const collider of this.#bodies.get(body) ?? []) {
      this.#colliders.delete(collider.native.handle);
    }
    this.#bodies.delete(body);
    this.#forced.delete(body);
    this.world.removeRigidBody(body.native);
  }

  addCollider(
    collider: RapierCollider
  ): void {
    this.#colliders.set(
      collider.native.handle,
      collider
    );
    this.#bodies.get(
      collider.body
    )?.add(collider);
  }

  removeCollider(
    collider: RapierCollider
  ): void {
    const colliders = this.#bodies.get(collider.body);
    if (colliders?.delete(collider)) {
      this.#colliders.delete(collider.native.handle);
      this.world.removeCollider(
        collider.native,
        true
      );
    }
  }

  markForced(
    body: RapierBody
  ): void {
    this.#forced.add(body);
  }

  resetForces(): void {
    for (const body of this.#forced) {
      body.native.resetForces(false);
    }
    this.#forced.clear();
  }

  clear(): void {
    this.#colliders.clear();
    this.#bodies.clear();
    this.#forced.clear();
  }
}
