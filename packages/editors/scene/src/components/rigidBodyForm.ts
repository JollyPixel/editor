// Import Third-party Dependencies
import {
  FormRows,
  type ChoiceOption,
  type FieldRow,
  type FormRow
} from "@jolly-pixel/editor.host/scene";
import type { BodyKind } from "@jolly-pixel/physics";
import {
  COLLIDER_SETTINGS_DEFAULTS,
  type SceneColliderSettings,
  type SceneColliderShape,
  type SceneRigidBodySettings
} from "@jolly-pixel/physics/engine";

// CONSTANTS
const kBody = new FormRows<SceneRigidBodySettings>();
const kCollider = new FormRows<SceneColliderSettings>();
const kSize = { min: 0, step: 0.05 } as const;
const kUnit = { min: 0, max: 1, step: 0.01 } as const;

const kBodyKinds: readonly ChoiceOption[] = [
  {
    value: "dynamic",
    label: "Dynamic"
  },
  {
    value: "kinematic",
    label: "Kinematic"
  },
  {
    value: "fixed",
    label: "Fixed"
  }
] satisfies (ChoiceOption & { value: BodyKind; })[];
const kShapes: readonly ChoiceOption[] = [
  {
    value: "box",
    label: "Box"
  },
  {
    value: "sphere",
    label: "Sphere"
  },
  {
    value: "capsule",
    label: "Capsule"
  }
] satisfies (ChoiceOption & { value: SceneColliderShape["type"]; })[];

const kShapeRows: Readonly<
  Record<SceneColliderShape["type"], readonly FieldRow<SceneColliderSettings>[]>
> = {
  box: [
    kCollider.vector(["shape", "halfExtents"], "Half extents", kSize)
  ],
  sphere: [
    kCollider.number(["shape", "radius"], "Radius", kSize)
  ],
  capsule: [
    kCollider.number(["shape", "halfHeight"], "Half height", kSize),
    kCollider.number(["shape", "radius"], "Radius", kSize)
  ]
};

export function rigidBodyForm(
  data: SceneRigidBodySettings
): FormRow<SceneRigidBodySettings>[] {
  return [
    kBody.choice(["kind"], "Kind", kBodyKinds),
    kBody.list("colliders", "Colliders", {
      itemLabel: "Collider",
      seed: COLLIDER_SETTINGS_DEFAULTS,
      rows: colliderRows
    }),
    ...data.kind === "dynamic" ?
      [
        kBody.number(["gravityScale"], "Gravity scale", { step: 0.1 }),
        kBody.number(["linearDamping"], "Linear damping", kSize),
        kBody.number(["angularDamping"], "Angular damping", kSize),
        kBody.boolean(["lockRotations"], "Lock rotations"),
        kBody.boolean(["ccd"], "Continuous collision")
      ] :
      []
  ];
}

function colliderRows(
  collider: SceneColliderSettings
): FieldRow<SceneColliderSettings>[] {
  return [
    {
      ...kCollider.choice(["shape", "type"], "Shape", kShapes),
      resets: true
    },
    ...kShapeRows[collider.shape.type],
    kCollider.vector(["offset"], "Offset", { step: 0.05 }),
    kCollider.boolean(["sensor"], "Sensor"),
    kCollider.number(["friction"], "Friction", kSize),
    kCollider.number(["restitution"], "Restitution", kUnit),
    kCollider.number(["density"], "Density", kSize)
  ];
}
