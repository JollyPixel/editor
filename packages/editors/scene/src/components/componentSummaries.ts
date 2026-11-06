// Import Third-party Dependencies
import type { SceneComponentSummary } from "@jolly-pixel/editor.host/scene";
import type {
  CameraData,
  LightSettings,
  MeshGeometryKind,
  MeshSettings,
  TextSettings
} from "@jolly-pixel/engine";
import type { SceneRigidBodySettings } from "@jolly-pixel/physics/engine";

type ColliderType = SceneRigidBodySettings["colliders"][number]["shape"]["type"];

// CONSTANTS
const kTextLength = 24;
const kCameraLabels: Record<CameraData["projectionMode"], string> = {
  perspective: "Perspective camera",
  orthographic: "Orthographic camera"
};
const kLightLabels: Record<LightSettings["kind"], string> = {
  ambient: "Ambient light",
  hemisphere: "Hemisphere light",
  directional: "Directional light",
  point: "Point light",
  spot: "Spot light"
};
const kMeshLabels: Record<MeshGeometryKind, string> = {
  box: "Box mesh",
  sphere: "Sphere mesh",
  plane: "Plane mesh",
  cylinder: "Cylinder mesh",
  cone: "Cone mesh",
  torus: "Torus mesh",
  capsule: "Capsule mesh"
};
const kBodyLabels: Record<SceneRigidBodySettings["kind"], string> = {
  dynamic: "Dynamic body",
  kinematic: "Kinematic body",
  fixed: "Fixed body"
};
const kColliderLabels: Record<ColliderType, string> = {
  box: "Box",
  sphere: "Sphere",
  capsule: "Capsule"
};

export function describeCamera(
  data: CameraData
): SceneComponentSummary {
  return { label: kCameraLabels[data.projectionMode] };
}

export function describeLight(
  data: LightSettings
): SceneComponentSummary {
  return { label: kLightLabels[data.kind] };
}

export function describeMesh(
  data: MeshSettings
): SceneComponentSummary {
  return { label: kMeshLabels[data.geometry.kind] };
}

export function describeText(
  data: TextSettings
): SceneComponentSummary {
  const [line = ""] = data.text.trim().split("\n");

  return line === "" ?
    { label: "Text" } :
    {
      label: "Text",
      detail: `"${clip(line)}"`
    };
}

export function describeRigidBody(
  data: SceneRigidBodySettings
): SceneComponentSummary {
  const label = kBodyLabels[data.kind];
  const { colliders } = data;
  if (colliders.length === 0) {
    return { label };
  }

  return {
    label,
    detail: colliders.length === 1 ?
      kColliderLabels[colliders[0].shape.type] :
      `${colliders.length} colliders`
  };
}

function clip(
  text: string
): string {
  return text.length > kTextLength ?
    `${text.slice(0, kTextLength - 1).trimEnd()}…` :
    text;
}
