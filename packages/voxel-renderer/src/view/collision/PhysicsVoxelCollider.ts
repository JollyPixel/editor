// Import Third-party Dependencies
import type {
  PhysicsBody,
  PhysicsWorld
} from "@jolly-pixel/physics";

// Import Internal Dependencies
import type {
  VoxelChunkCollision,
  VoxelCollider,
  VoxelColliderContext
} from "./VoxelCollider.ts";
import { VoxelCollisionShapes } from "./VoxelCollisionShapes.ts";

export interface PhysicsVoxelColliderOptions extends VoxelColliderContext {
  world: Pick<PhysicsWorld, "createBody">;
}

export class PhysicsVoxelCollider implements VoxelCollider {
  #world: Pick<PhysicsWorld, "createBody">;
  #shapes: VoxelCollisionShapes;
  #bodies = new Map<string, PhysicsBody>();

  constructor(
    options: PhysicsVoxelColliderOptions
  ) {
    this.#world = options.world;
    this.#shapes = new VoxelCollisionShapes(options);
  }

  rebuildChunk(
    key: string,
    collision: VoxelChunkCollision
  ): void {
    this.removeChunk(key);

    const colliders = this.#shapes.extract(collision);
    if (colliders.length === 0) {
      return;
    }

    const { x, y, z } = collision.origin;
    const body = this.#world.createBody({
      kind: "fixed",
      position: { x, y, z }
    });
    this.#bodies.set(key, body);
    for (const collider of colliders) {
      body.attach(collider);
    }
  }

  removeChunk(
    key: string
  ): void {
    const body = this.#bodies.get(key);
    if (body === undefined) {
      return;
    }

    body.remove();
    this.#bodies.delete(key);
  }

  dispose(): void {
    for (const body of this.#bodies.values()) {
      body.remove();
    }
    this.#bodies.clear();
    this.#shapes.clear();
  }
}
