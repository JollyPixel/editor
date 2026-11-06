// Import Internal Dependencies
import type { ColliderDesc } from "./ColliderShape.ts";
import type { PhysicsCollider } from "./PhysicsCollider.ts";
import type {
  QuaternionLike,
  Vector3Like
} from "./vectors.ts";

export type BodyKind = "dynamic" | "kinematic" | "fixed";

export interface BodyDesc {
  kind: BodyKind;
  /**
   * @default { x: 0, y: 0, z: 0 }
   */
  position?: Vector3Like;
  /**
   * @default { x: 0, y: 0, z: 0, w: 1 }
   */
  rotation?: QuaternionLike;
  /**
   * @default 0
   */
  linearDamping?: number;
  /**
   * @default 0
   */
  angularDamping?: number;
  /**
   * @default 1
   */
  gravityScale?: number;
  /**
   * Continuous collision detection, for small or fast bodies.
   * @default false
   */
  ccd?: boolean;
  /**
   * @default false
   */
  lockRotations?: boolean;
}

export const BODY_DEFAULTS = {
  linearDamping: 0,
  angularDamping: 0,
  gravityScale: 1,
  ccd: false,
  lockRotations: false
} as const;

export interface PhysicsBody {
  readonly kind: BodyKind;
  readonly position: Vector3Like;
  readonly rotation: QuaternionLike;
  linearVelocity: Vector3Like;
  angularVelocity: Vector3Like;

  teleport(
    position: Vector3Like,
    rotation?: QuaternionLike
  ): void;
  moveTo(
    position: Vector3Like,
    rotation?: QuaternionLike
  ): void;
  applyImpulse(
    impulse: Vector3Like
  ): void;
  applyForce(
    force: Vector3Like
  ): void;
  attach(
    desc: ColliderDesc
  ): PhysicsCollider;
  remove(): void;
}
