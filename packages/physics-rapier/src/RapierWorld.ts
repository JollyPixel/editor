// Import Third-party Dependencies
import RAPIER from "@dimforge/rapier3d-compat";
import type {
  BodyDesc,
  ContactListener,
  PhysicsWorld,
  Ray,
  RayHit,
  Vector3Like
} from "@jolly-pixel/physics";

// Import Internal Dependencies
import { RapierBody } from "./RapierBody.ts";
import { RapierScene } from "./RapierScene.ts";
import { copyVector } from "./vectors.ts";

export class RapierWorld implements PhysicsWorld {
  readonly native: RAPIER.World;

  #scene: RapierScene;
  #events = new RAPIER.EventQueue(true);
  #disposed = false;

  constructor(
    native: RAPIER.World
  ) {
    this.native = native;
    this.#scene = new RapierScene(native);
  }

  get gravity(): Vector3Like {
    const { x, y, z } = this.native.gravity;

    return { x, y, z };
  }

  set gravity(
    value: Vector3Like
  ) {
    this.native.gravity = copyVector(value);
  }

  createBody(
    desc: BodyDesc
  ): RapierBody {
    this.#assertAlive();

    return new RapierBody(this.#scene, desc);
  }

  step(
    seconds: number
  ): void {
    this.#assertAlive();
    this.native.timestep = seconds;
    this.native.step(this.#events);
    this.#scene.resetForces();
  }

  drainContacts(
    listener: ContactListener
  ): void {
    this.#events.drainCollisionEvents((firstHandle, secondHandle, started) => {
      const first = this.#scene.collider(firstHandle);
      const second = this.#scene.collider(secondHandle);
      if (first !== undefined && second !== undefined) {
        listener({
          started,
          first,
          second
        });
      }
    });
  }

  castRay(
    ray: Ray
  ): RayHit | null {
    const {
      origin, direction, maxDistance, exclude
    } = ray;

    const length = Math.hypot(
      direction.x,
      direction.y,
      direction.z
    );
    if (length === 0) {
      return null;
    }

    const unit = {
      x: direction.x / length,
      y: direction.y / length,
      z: direction.z / length
    };
    const hit = this.native.castRayAndGetNormal(
      new RAPIER.Ray(copyVector(origin), unit),
      maxDistance,
      true,
      undefined,
      undefined,
      undefined,
      exclude instanceof RapierBody ? exclude.native : undefined
    );
    if (hit === null) {
      return null;
    }
    const collider = this.#scene.collider(hit.collider.handle);
    if (collider === undefined) {
      return null;
    }

    const distance = hit.timeOfImpact;

    return {
      collider,
      distance,
      point: {
        x: origin.x + (unit.x * distance),
        y: origin.y + (unit.y * distance),
        z: origin.z + (unit.z * distance)
      },
      normal: {
        x: hit.normal.x,
        y: hit.normal.y,
        z: hit.normal.z
      }
    };
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;

    this.#scene.clear();
    this.#events.free();
    this.native.free();
  }

  #assertAlive(): void {
    if (this.#disposed) {
      throw new Error("The physics world was disposed.");
    }
  }
}
