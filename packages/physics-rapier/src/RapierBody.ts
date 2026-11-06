// Import Third-party Dependencies
import RAPIER from "@dimforge/rapier3d-compat";
import {
  BODY_DEFAULTS,
  type BodyDesc,
  type BodyKind,
  type ColliderDesc,
  type PhysicsBody,
  type QuaternionLike,
  type Vector3Like
} from "@jolly-pixel/physics";

// Import Internal Dependencies
import { RapierCollider } from "./RapierCollider.ts";
import type { RapierScene } from "./RapierScene.ts";
import {
  copyQuaternion,
  copyVector
} from "./vectors.ts";

export class RapierBody implements PhysicsBody {
  readonly kind: BodyKind;
  readonly native: RAPIER.RigidBody;

  #scene: RapierScene;

  constructor(
    scene: RapierScene,
    desc: BodyDesc
  ) {
    this.kind = desc.kind;
    this.#scene = scene;
    this.native = scene.world.createRigidBody(
      createBodyDesc(desc)
    );
    scene.addBody(this);
  }

  get position(): Vector3Like {
    const { x, y, z } = this.#alive().translation();

    return { x, y, z };
  }

  get rotation(): QuaternionLike {
    const { x, y, z, w } = this.#alive().rotation();

    return { x, y, z, w };
  }

  get linearVelocity(): Vector3Like {
    const { x, y, z } = this.#alive().linvel();

    return { x, y, z };
  }

  set linearVelocity(
    value: Vector3Like
  ) {
    this.#alive().setLinvel(
      copyVector(value),
      true
    );
  }

  get angularVelocity(): Vector3Like {
    const { x, y, z } = this.#alive().angvel();

    return { x, y, z };
  }

  set angularVelocity(
    value: Vector3Like
  ) {
    this.#alive().setAngvel(
      copyVector(value),
      true
    );
  }

  teleport(
    position: Vector3Like,
    rotation?: QuaternionLike
  ): void {
    const body = this.#alive();
    body.setTranslation(
      copyVector(position),
      true
    );
    if (rotation !== undefined) {
      body.setRotation(
        copyQuaternion(rotation),
        true
      );
    }
  }

  moveTo(
    position: Vector3Like,
    rotation?: QuaternionLike
  ): void {
    const body = this.#alive();
    body.setNextKinematicTranslation(
      copyVector(position)
    );
    if (rotation !== undefined) {
      body.setNextKinematicRotation(
        copyQuaternion(rotation)
      );
    }
  }

  applyImpulse(
    impulse: Vector3Like
  ): void {
    this.#alive().applyImpulse(
      copyVector(impulse),
      true
    );
  }

  applyForce(
    force: Vector3Like
  ): void {
    this.#alive().addForce(
      copyVector(force),
      true
    );
    this.#scene.markForced(this);
  }

  attach(
    desc: ColliderDesc
  ): RapierCollider {
    this.#alive();

    return new RapierCollider(
      this,
      this.#scene,
      desc
    );
  }

  remove(): void {
    if (this.#scene.hasBody(this)) {
      this.#scene.removeBody(this);
    }
  }

  #alive(): RAPIER.RigidBody {
    if (!this.#scene.hasBody(this)) {
      throw new Error("The physics body was removed.");
    }

    return this.native;
  }
}

function createBodyDesc(
  desc: BodyDesc
): RAPIER.RigidBodyDesc {
  const {
    kind,
    position = { x: 0, y: 0, z: 0 },
    rotation = { x: 0, y: 0, z: 0, w: 1 },
    linearDamping = BODY_DEFAULTS.linearDamping,
    angularDamping = BODY_DEFAULTS.angularDamping,
    gravityScale = BODY_DEFAULTS.gravityScale,
    ccd = BODY_DEFAULTS.ccd,
    lockRotations = BODY_DEFAULTS.lockRotations
  } = desc;

  const bodyDesc = createKindDesc(kind)
    .setTranslation(position.x, position.y, position.z)
    .setRotation(copyQuaternion(rotation))
    .setLinearDamping(linearDamping)
    .setAngularDamping(angularDamping)
    .setGravityScale(gravityScale)
    .setCcdEnabled(ccd);

  return lockRotations ? bodyDesc.lockRotations() : bodyDesc;
}

function createKindDesc(
  kind: BodyKind
): RAPIER.RigidBodyDesc {
  switch (kind) {
    case "dynamic":
      return RAPIER.RigidBodyDesc.dynamic();
    case "kinematic":
      return RAPIER.RigidBodyDesc.kinematicPositionBased();
    case "fixed":
      return RAPIER.RigidBodyDesc.fixed();
    default:
      return kind satisfies never;
  }
}
