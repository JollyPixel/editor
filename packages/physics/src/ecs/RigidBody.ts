// Import Third-party Dependencies
import {
  type Actor,
  ActorComponent,
  SignalEvent,
  decomposeMatrix,
  loadMatrix,
  loadQuaternion,
  loadVector3,
  writeQuaternion,
  writeVector3
} from "@jolly-pixel/ecs";
import {
  mat4,
  quat,
  vec3,
  type Quat,
  type Vec3
} from "math";

// Import Internal Dependencies
import {
  COLLIDER_DEFAULTS,
  type ColliderDesc
} from "../ColliderShape.ts";
import {
  BODY_DEFAULTS,
  type BodyDesc,
  type PhysicsBody
} from "../PhysicsBody.ts";
import type { PhysicsCollider } from "../PhysicsCollider.ts";
import type {
  QuaternionLike,
  Vector3Like
} from "../vectors.ts";
import {
  PhysicsSystem,
  type ActorContact,
  type PhysicsStepObserver
} from "./PhysicsSystem.ts";
import { scaleCollider } from "./shapes/scale.ts";

// CONSTANTS
const kMatrix = mat4.create();
const kPosition = vec3.create();
const kRotation = quat.create();
const kScale = vec3.create();
const kActorScale: Vector3Like = {
  x: 1,
  y: 1,
  z: 1
};
const kActorPosition: Vector3Like = {
  x: 0,
  y: 0,
  z: 0
};
const kActorRotation: QuaternionLike = {
  x: 0,
  y: 0,
  z: 0,
  w: 1
};

export type ColliderSettings = Required<Omit<ColliderDesc, "rotation">>;

export const COLLIDER_SETTINGS_DEFAULTS = Object.freeze({
  ...COLLIDER_DEFAULTS,
  shape: {
    type: "box",
    halfExtents: {
      x: 0.5,
      y: 0.5,
      z: 0.5
    }
  },
  offset: {
    x: 0,
    y: 0,
    z: 0
  }
} satisfies ColliderSettings);

export interface RigidBodySettings extends Required<
  Omit<BodyDesc, "position" | "rotation">
> {
  colliders: readonly Readonly<ColliderSettings>[];
}

export interface RigidBodyOptions extends Partial<
  Omit<RigidBodySettings, "colliders">
> {
  colliders?: readonly Partial<ColliderSettings>[];
}

export const RIGID_BODY_DEFAULTS: Readonly<RigidBodySettings> = Object.freeze({
  kind: "dynamic",
  ...BODY_DEFAULTS,
  colliders: Object.freeze([COLLIDER_SETTINGS_DEFAULTS])
});

export class RigidBody extends ActorComponent {
  readonly settings: Readonly<RigidBodySettings>;
  readonly body: PhysicsBody;
  readonly colliders: readonly PhysicsCollider[];
  readonly contactStarted = new SignalEvent<[contact: ActorContact]>();
  readonly contactEnded = new SignalEvent<[contact: ActorContact]>();

  #previous = {
    position: vec3.create(),
    rotation: quat.create()
  };
  #current = {
    position: vec3.create(),
    rotation: quat.create()
  };

  constructor(
    actor: Actor<any>,
    options: RigidBodyOptions = {}
  ) {
    const settings = resolveSettings(options);
    super({
      actor,
      typeName: "RigidBody",
      needUpdate: settings.kind === "dynamic"
    });
    this.settings = settings;

    const system = PhysicsSystem.require(actor.world);
    decomposeMatrix(
      loadMatrix(kMatrix, actor.transform.global.matrix),
      this.#current.position,
      this.#current.rotation,
      kScale
    );
    this.#snap();

    const { colliders, ...bodySettings } = settings;
    this.body = system
      .ownedBodies(actor, (contact) => this.#contact(contact))
      .createBody({
        ...bodySettings,
        position: writeVector3(kActorPosition, this.#current.position),
        rotation: writeQuaternion(kActorRotation, this.#current.rotation)
      });
    const scale = writeVector3(kActorScale, kScale);
    this.colliders = colliders.map(
      (collider) => this.body.attach(scaleCollider(collider, scale))
    );
    this.addTeardown(system.observeSteps(this.#stepObserver()));
  }

  teleport(
    position: Vector3Like,
    rotation: QuaternionLike = this.body.rotation
  ): void {
    this.body.teleport(position, rotation);
    loadVector3(this.#current.position, position);
    loadQuaternion(this.#current.rotation, rotation);
    this.#snap();
    this.#writeActorPose(this.#current.position, this.#current.rotation);
  }

  update(
    _deltaTime: number,
    alpha = 0
  ): void {
    vec3.lerp(
      kPosition,
      this.#previous.position,
      this.#current.position,
      alpha
    );
    quat.slerp(
      kRotation,
      this.#previous.rotation,
      this.#current.rotation,
      alpha
    );
    this.#writeActorPose(kPosition, kRotation);
  }

  protected override onDestroy(): void {
    this.body.remove();
    this.contactStarted.clear();
    this.contactEnded.clear();
  }

  #contact(
    contact: ActorContact
  ): void {
    if (contact.started) {
      this.contactStarted.emit(contact);
    }
    else {
      this.contactEnded.emit(contact);
    }
  }

  #stepObserver(): PhysicsStepObserver {
    switch (this.settings.kind) {
      case "dynamic":
        return {
          afterStep: () => this.#captureDynamicPose()
        };
      case "kinematic":
        return {
          beforeStep: () => this.#pushKinematicPose()
        };
      case "fixed":
        return {};
      default:
        return this.settings.kind satisfies never;
    }
  }

  #pushKinematicPose(): void {
    const { transform } = this.actor;
    this.body.moveTo(
      transform.global.position,
      transform.global.orientation
    );
  }

  #captureDynamicPose(): void {
    this.#snap();
    loadVector3(this.#current.position, this.body.position);
    loadQuaternion(this.#current.rotation, this.body.rotation);
  }

  #snap(): void {
    vec3.copy(this.#previous.position, this.#current.position);
    quat.copy(this.#previous.rotation, this.#current.rotation);
  }

  #writeActorPose(
    position: Readonly<Vec3>,
    rotation: Readonly<Quat>
  ): void {
    const { transform } = this.actor;
    transform.global.position = writeVector3(kActorPosition, position);
    transform.global.orientation = writeQuaternion(kActorRotation, rotation);
  }
}

function resolveSettings(
  options: RigidBodyOptions
): Readonly<RigidBodySettings> {
  const colliders = options.colliders?.map(
    (collider) => Object.freeze({
      ...COLLIDER_SETTINGS_DEFAULTS,
      ...collider
    })
  );

  return Object.freeze({
    ...RIGID_BODY_DEFAULTS,
    ...options,
    colliders: colliders === undefined ?
      RIGID_BODY_DEFAULTS.colliders :
      Object.freeze(colliders)
  });
}
