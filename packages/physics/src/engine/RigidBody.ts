// Import Third-party Dependencies
import {
  type Actor,
  ActorComponent,
  SignalEvent
} from "@jolly-pixel/engine";
import * as THREE from "three";

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
const kPosition = new THREE.Vector3();
const kRotation = new THREE.Quaternion();
const kScale = new THREE.Vector3();

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
  readonly contacts = new SignalEvent<[contact: ActorContact]>();

  #previous = {
    position: new THREE.Vector3(),
    rotation: new THREE.Quaternion()
  };
  #current = {
    position: new THREE.Vector3(),
    rotation: new THREE.Quaternion()
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
    const { object3D } = actor;
    object3D.updateWorldMatrix(true, false);
    object3D.matrixWorld.decompose(
      this.#current.position,
      this.#current.rotation,
      kScale
    );
    this.#snap();

    const { colliders, ...bodySettings } = settings;
    this.body = system
      .ownedBodies(actor, (contact) => this.contacts.emit(contact))
      .createBody({
        ...bodySettings,
        position: this.#current.position,
        rotation: this.#current.rotation
      });
    this.colliders = colliders.map(
      (collider) => this.body.attach(scaleCollider(collider, kScale))
    );
    this.addTeardown(system.observeSteps(this.#stepObserver()));
  }

  teleport(
    position: Vector3Like,
    rotation: QuaternionLike = this.body.rotation
  ): void {
    this.body.teleport(position, rotation);
    this.#current.position.copy(position);
    this.#current.rotation.copy(rotation);
    this.#snap();
    this.#writeActorPose(this.#current.position, this.#current.rotation);
  }

  update(
    _deltaTime: number,
    alpha = 0
  ): void {
    kPosition.lerpVectors(
      this.#previous.position,
      this.#current.position,
      alpha
    );
    kRotation.slerpQuaternions(
      this.#previous.rotation,
      this.#current.rotation,
      alpha
    );
    this.#writeActorPose(kPosition, kRotation);
  }

  protected override onDestroy(): void {
    this.body.remove();
    this.contacts.clear();
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
    const { object3D } = this.actor;
    object3D.updateWorldMatrix(true, false);
    this.body.moveTo(
      object3D.getWorldPosition(kPosition),
      object3D.getWorldQuaternion(kRotation)
    );
  }

  #captureDynamicPose(): void {
    this.#previous.position.copy(this.#current.position);
    this.#previous.rotation.copy(this.#current.rotation);
    this.#current.position.copy(this.body.position);
    this.#current.rotation.copy(this.body.rotation);
  }

  #snap(): void {
    this.#previous.position.copy(this.#current.position);
    this.#previous.rotation.copy(this.#current.rotation);
  }

  #writeActorPose(
    position: THREE.Vector3,
    rotation: THREE.Quaternion
  ): void {
    this.actor.transform
      .setGlobalPosition(position)
      .setGlobalOrientation(rotation);
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
