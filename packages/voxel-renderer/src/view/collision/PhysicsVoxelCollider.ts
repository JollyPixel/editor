// Import Third-party Dependencies
import type {
  PhysicsBody,
  PhysicsWorld
} from "@jolly-pixel/physics";
import * as THREE from "three";

// Import Internal Dependencies
import type {
  VoxelChunkCollision,
  VoxelCollider,
  VoxelColliderContext
} from "./VoxelCollider.ts";
import { VoxelCollisionShapes } from "./VoxelCollisionShapes.ts";

// CONSTANTS
const kBodyPosition = new THREE.Vector3();

export interface PhysicsVoxelColliderOptions extends VoxelColliderContext {
  world: Pick<PhysicsWorld, "createBody">;
  placement?: Readonly<THREE.Matrix4>;
}

export class PhysicsVoxelCollider implements VoxelCollider {
  #world: Pick<PhysicsWorld, "createBody">;
  #shapes: VoxelCollisionShapes;
  #placement = new THREE.Matrix4();
  #rotation = new THREE.Quaternion();
  #bodies = new Map<string, PhysicsBody>();

  constructor(
    options: PhysicsVoxelColliderOptions
  ) {
    const scale = new THREE.Vector3();
    if (options.placement) {
      this.#placement.copy(options.placement);
    }
    this.#placement.decompose(kBodyPosition, this.#rotation, scale);

    this.#world = options.world;
    this.#shapes = new VoxelCollisionShapes({
      ...options,
      scale
    });
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
    const position = kBodyPosition
      .set(x, y, z)
      .applyMatrix4(this.#placement);
    const body = this.#world.createBody({
      kind: "fixed",
      position: {
        x: position.x,
        y: position.y,
        z: position.z
      },
      rotation: {
        x: this.#rotation.x,
        y: this.#rotation.y,
        z: this.#rotation.z,
        w: this.#rotation.w
      }
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
