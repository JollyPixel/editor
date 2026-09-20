// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  attribute,
  cameraProjectionMatrix,
  Fn,
  modelViewMatrix,
  positionLocal,
  screenDPR,
  screenSize,
  uniform,
  vec4
} from "three/tsl";

// Import Internal Dependencies
import type { ResolvedOutline } from "../appearance.ts";

// CONSTANTS
export const OUTLINE_NORMAL_ATTRIBUTE = "outlineNormal";
const kOutlineClipMargin = 0.03;

export function createFrontClip() {
  return {
    eye: uniform(new THREE.Vector3(0, 0, 1))
  };
}

export type FrontClip = ReturnType<typeof createFrontClip>;

export interface VisualMaterialOptions {
  color: THREE.ColorRepresentation;
  opacity: number;
  depthTest: boolean;
  side?: THREE.Side;
  clip?: FrontClip;
}

export interface OutlineMaterialOptions {
  outline: ResolvedOutline;
  depthTest: boolean;
  clip?: FrontClip;
}

export function createVisualMaterial(
  options: VisualMaterialOptions
): THREE.MeshBasicNodeMaterial {
  const {
    color,
    opacity,
    depthTest,
    side = THREE.FrontSide,
    clip
  } = options;

  const material = new THREE.MeshBasicNodeMaterial({
    color,
    transparent: true,
    opacity,
    depthTest,
    side,
    depthWrite: false,
    fog: false,
    toneMapped: false
  });
  if (clip !== undefined) {
    material.maskNode = positionLocal.dot(clip.eye).greaterThanEqual(0);
  }

  return material;
}

export function createOutlineMaterial(
  options: OutlineMaterialOptions
): THREE.MeshBasicNodeMaterial {
  const { outline, depthTest, clip } = options;

  const material = new THREE.MeshBasicNodeMaterial({
    color: outline.color,
    transparent: true,
    opacity: outline.opacity,
    depthTest,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    side: THREE.BackSide
  });
  const width = uniform(outline.width, "float");

  material.vertexNode = Fn(() => {
    const miter = attribute(OUTLINE_NORMAL_ATTRIBUTE, "vec3");
    const modelScale = modelViewMatrix.mul(vec4(1, 0, 0, 0)).xyz.length();
    const direction = modelViewMatrix
      .mul(vec4(miter, 0))
      .xy
      .div(modelScale);
    const clipPosition = cameraProjectionMatrix
      .mul(modelViewMatrix)
      .mul(vec4(positionLocal, 1));
    const offset = direction
      .mul(width.mul(screenDPR).mul(2))
      .div(screenSize)
      .mul(clipPosition.w);

    return vec4(clipPosition.xy.add(offset), clipPosition.zw);
  })();
  if (clip !== undefined) {
    material.maskNode = positionLocal
      .dot(clip.eye)
      .greaterThanEqual(-kOutlineClipMargin);
  }

  return material;
}
