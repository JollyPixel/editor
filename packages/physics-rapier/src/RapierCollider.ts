// Import Third-party Dependencies
import RAPIER from "@dimforge/rapier3d-compat";
import {
  COLLIDER_DEFAULTS,
  type ColliderDesc,
  type ColliderShape,
  type PhysicsCollider
} from "@jolly-pixel/physics";

// Import Internal Dependencies
import type { RapierBody } from "./RapierBody.ts";
import type { RapierScene } from "./RapierScene.ts";
import { copyQuaternion } from "./vectors.ts";

export class RapierCollider implements PhysicsCollider {
  readonly body: RapierBody;
  readonly sensor: boolean;
  readonly native: RAPIER.Collider;

  #scene: RapierScene;

  constructor(
    body: RapierBody,
    scene: RapierScene,
    desc: ColliderDesc
  ) {
    this.body = body;
    this.#scene = scene;
    this.native = scene.world.createCollider(
      createColliderDesc(desc),
      body.native
    );
    this.sensor = this.native.isSensor();
    scene.addCollider(this);
  }

  detach(): void {
    this.#scene.removeCollider(this);
  }
}

function createColliderDesc(
  desc: ColliderDesc
): RAPIER.ColliderDesc {
  const {
    shape,
    offset = { x: 0, y: 0, z: 0 },
    rotation = { x: 0, y: 0, z: 0, w: 1 },
    friction = COLLIDER_DEFAULTS.friction,
    restitution = COLLIDER_DEFAULTS.restitution,
    density = COLLIDER_DEFAULTS.density,
    sensor = COLLIDER_DEFAULTS.sensor
  } = desc;

  return createShapeDesc(shape)
    .setTranslation(offset.x, offset.y, offset.z)
    .setRotation(copyQuaternion(rotation))
    .setFriction(friction)
    .setRestitution(restitution)
    .setDensity(density)
    .setSensor(sensor)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
}

function createShapeDesc(
  shape: ColliderShape
): RAPIER.ColliderDesc {
  switch (shape.type) {
    case "box":
      return RAPIER.ColliderDesc.cuboid(
        shape.halfExtents.x,
        shape.halfExtents.y,
        shape.halfExtents.z
      );
    case "sphere":
      return RAPIER.ColliderDesc.ball(
        shape.radius
      );
    case "capsule":
      return RAPIER.ColliderDesc.capsule(
        shape.halfHeight,
        shape.radius
      );
    case "trimesh":
      return RAPIER.ColliderDesc.trimesh(
        shape.vertices,
        shape.indices
      );
    default:
      return shape satisfies never;
  }
}
