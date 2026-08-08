// Import Third-party Dependencies
import type * as THREE from "three";
import type {
  UVFace,
  UVGeometry,
  UVRegion
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { PreviewShape } from "./PreviewShape.ts";
import { createCubeShape } from "./shapes/CubeShape.ts";
import { createRampShape } from "./shapes/RampShape.ts";

// CONSTANTS
const kRampFaces: readonly UVFace[] = [
  "back",
  "left",
  "right",
  "top",
  "bottom"
];

export type PreviewShapeKind = "cube" | "ramp";

export function resolvePreviewShape(
  region: UVRegion,
  borderMaterial: THREE.MeshBasicMaterial
): PreviewShape {
  return resolvePreviewShapeKind(region) === "ramp" ?
    createRampShape(borderMaterial) :
    createCubeShape(borderMaterial);
}

export function resolvePreviewShapeKind(
  region: UVRegion
): PreviewShapeKind {
  const data = region.toJSON();
  const activeFaces = data.activeFaces;
  const faces = data.faces;

  if (!activeFaces || !faces || activeFaces.length !== kRampFaces.length) {
    return "cube";
  }
  if (!kRampFaces.every((face) => activeFaces.includes(face))) {
    return "cube";
  }
  if (!isTriangle(faces.left) || !isTriangle(faces.right)) {
    return "cube";
  }

  return "ramp";
}

function isTriangle(
  geometry: UVGeometry
): boolean {
  return "shape" in geometry && geometry.shape === "triangle";
}
