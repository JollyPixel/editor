// Import Third-party Dependencies
import {
  type Actor,
  type Component,
  Systems
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import type { BodyKind } from "../PhysicsBody.ts";
import type { ColliderShape } from "../ColliderShape.ts";
import type { Vector3Like } from "../vectors.ts";
import {
  COLLIDER_SETTINGS_DEFAULTS,
  RigidBody,
  RIGID_BODY_DEFAULTS,
  type ColliderSettings,
  type RigidBodySettings
} from "./RigidBody.ts";

// CONSTANTS
const kBodyKinds: Record<BodyKind, true> = {
  dynamic: true,
  kinematic: true,
  fixed: true
};
const kSceneShapes: Record<SceneColliderShape["type"], true> = {
  box: true,
  sphere: true,
  capsule: true
};
const kDefaultRadius = 0.5;
const kDefaultHalfHeight = 0.5;

export type SceneColliderShape = Exclude<ColliderShape, { type: "trimesh"; }>;

export interface SceneColliderSettings extends ColliderSettings {
  shape: SceneColliderShape;
}

export interface SceneRigidBodySettings extends RigidBodySettings {
  colliders: readonly Readonly<SceneColliderSettings>[];
}

export class RigidBodyDefinition implements Systems.ComponentDefinition<
  SceneRigidBodySettings,
  RigidBody
> {
  readonly type = "RigidBody";

  parse(
    data: Readonly<Systems.JSONObject>
  ): SceneRigidBodySettings {
    const fields = new Systems.ComponentData(data);
    const defaults = RIGID_BODY_DEFAULTS;

    return {
      kind: fields.choice("kind", kBodyKinds, defaults.kind),
      linearDamping: fields.number("linearDamping", defaults.linearDamping),
      angularDamping: fields.number("angularDamping", defaults.angularDamping),
      gravityScale: fields.number("gravityScale", defaults.gravityScale),
      ccd: fields.boolean("ccd", defaults.ccd),
      lockRotations: fields.boolean("lockRotations", defaults.lockRotations),
      colliders: parseColliders(data.colliders)
    };
  }

  create(
    actor: Actor<any>,
    data: SceneRigidBodySettings,
    context: Systems.ComponentContext
  ): RigidBody | null {
    if (context.mode === "edit") {
      return null;
    }

    return actor.addComponentAndGet(RigidBody, data);
  }

  owns(
    component: Component
  ): component is RigidBody {
    return component instanceof RigidBody &&
      component.settings.colliders.every(
        (collider) => collider.shape.type !== "trimesh"
      );
  }

  capture(
    component: RigidBody
  ): Systems.JSONObject {
    const { colliders, ...body } = component.settings;

    return {
      ...body,
      colliders: colliders.map(captureCollider)
    };
  }
}

function parseColliders(
  value: Systems.JSONValue | undefined
): SceneColliderSettings[] {
  if (!Array.isArray(value)) {
    return [COLLIDER_SETTINGS_DEFAULTS];
  }

  return value
    .filter(Systems.isJSONObject)
    .map((collider) => parseCollider(new Systems.ComponentData(collider)));
}

function parseCollider(
  fields: Systems.ComponentData
): SceneColliderSettings {
  const defaults = COLLIDER_SETTINGS_DEFAULTS;

  return {
    shape: parseShape(fields),
    offset: parseVector(fields, "offset", defaults.offset),
    friction: fields.number("friction", defaults.friction),
    restitution: fields.number("restitution", defaults.restitution),
    density: fields.number("density", defaults.density),
    sensor: fields.boolean("sensor", defaults.sensor)
  };
}

function captureCollider(
  collider: Readonly<ColliderSettings>
): Systems.JSONObject {
  const { shape, offset, ...material } = collider;
  if (shape.type === "trimesh") {
    throw new TypeError("A trimesh collider cannot be saved in a scene.");
  }

  return {
    ...material,
    ...captureShape(shape),
    offset: { ...offset }
  };
}

function parseShape(
  fields: Systems.ComponentData
): SceneColliderShape {
  const { shape } = COLLIDER_SETTINGS_DEFAULTS;
  const type = fields.choice("shape", kSceneShapes, shape.type);
  switch (type) {
    case "box":
      return {
        type,
        halfExtents: parseVector(fields, "halfExtents", shape.halfExtents)
      };
    case "sphere":
      return {
        type,
        radius: fields.number("radius", kDefaultRadius)
      };
    case "capsule":
      return {
        type,
        halfHeight: fields.number("halfHeight", kDefaultHalfHeight),
        radius: fields.number("radius", kDefaultRadius)
      };
    default:
      return type satisfies never;
  }
}

function captureShape(
  shape: SceneColliderShape
): Systems.JSONObject {
  switch (shape.type) {
    case "box":
      return {
        shape: shape.type,
        halfExtents: { ...shape.halfExtents }
      };
    case "sphere":
      return {
        shape: shape.type,
        radius: shape.radius
      };
    case "capsule":
      return {
        shape: shape.type,
        halfHeight: shape.halfHeight,
        radius: shape.radius
      };
    default:
      return shape satisfies never;
  }
}

function parseVector(
  fields: Systems.ComponentData,
  key: string,
  fallback: Vector3Like
): Vector3Like {
  const vector = fields.object(key);

  return {
    x: vector?.number("x", fallback.x) ?? fallback.x,
    y: vector?.number("y", fallback.y) ?? fallback.y,
    z: vector?.number("z", fallback.z) ?? fallback.z
  };
}
