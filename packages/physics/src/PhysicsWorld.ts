// Import Internal Dependencies
import type {
  BodyDesc,
  PhysicsBody
} from "./PhysicsBody.ts";
import type { PhysicsCollider } from "./PhysicsCollider.ts";
import type { Vector3Like } from "./vectors.ts";

export interface ContactEvent {
  started: boolean;
  first: PhysicsCollider;
  second: PhysicsCollider;
}

export type ContactListener = (event: ContactEvent) => void;

export interface Ray {
  origin: Vector3Like;
  direction: Vector3Like;
  maxDistance: number;
  exclude?: PhysicsBody;
}

export interface RayHit {
  collider: PhysicsCollider;
  distance: number;
  point: Vector3Like;
  normal: Vector3Like;
}

export interface PhysicsWorldOptions {
  /**
   * @default { x: 0, y: -9.81, z: 0 }
   */
  gravity?: Vector3Like;
}

export const DEFAULT_GRAVITY: Readonly<Vector3Like> = Object.freeze({
  x: 0,
  y: -9.81,
  z: 0
});

export interface PhysicsWorld {
  gravity: Vector3Like;

  createBody(
    desc: BodyDesc
  ): PhysicsBody;
  step(
    seconds: number
  ): void;
  drainContacts(
    listener: ContactListener
  ): void;
  castRay(
    ray: Ray
  ): RayHit | null;
  dispose(): void;
}

export interface PhysicsBackend {
  readonly name: string;

  createWorld(
    options?: PhysicsWorldOptions
  ): PhysicsWorld;
}
