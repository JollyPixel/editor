// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
const kUpGapRatio = 0.1;
const kUpHalfBaseRatio = 0.35;
const kUpHeightRatio = 0.3;

export type FrustumLens =
  | {
    projection: "perspective";
    fov: number;
    aspect: number;
    near: number;
    far: number;
  }
  | {
    projection: "orthographic";
    height: number;
    aspect: number;
    near: number;
    far: number;
  };

export interface FrustumLinesOptions {
  apex?: boolean;
  up?: boolean;
}

interface FrustumRectangle {
  topLeft: THREE.Vector3;
  topRight: THREE.Vector3;
  bottomRight: THREE.Vector3;
  bottomLeft: THREE.Vector3;
}

export function frustumLinePoints(
  lens: FrustumLens,
  options: FrustumLinesOptions = {}
): THREE.Vector3[] {
  const near = frustumRectangle(lens, lens.near);
  const far = frustumRectangle(lens, lens.far);

  const points = [
    ...rectangleEdges(near),
    ...rectangleEdges(far),
    near.topLeft, far.topLeft,
    near.topRight, far.topRight,
    near.bottomRight, far.bottomRight,
    near.bottomLeft, far.bottomLeft
  ];

  if (options.apex && lens.projection === "perspective") {
    const apex = new THREE.Vector3();
    points.push(...[
      apex, near.topLeft,
      apex, near.topRight,
      apex, near.bottomRight,
      apex, near.bottomLeft
    ]);
  }
  if (options.up) {
    points.push(...upTriangle(far));
  }

  return points;
}

function frustumRectangle(
  lens: FrustumLens,
  distance: number
): FrustumRectangle {
  const halfHeight = lens.projection === "perspective" ?
    distance * Math.tan((lens.fov / 2) * THREE.MathUtils.DEG2RAD) :
    lens.height / 2;
  const halfWidth = halfHeight * lens.aspect;

  return {
    topLeft: new THREE.Vector3(-halfWidth, halfHeight, -distance),
    topRight: new THREE.Vector3(halfWidth, halfHeight, -distance),
    bottomRight: new THREE.Vector3(halfWidth, -halfHeight, -distance),
    bottomLeft: new THREE.Vector3(-halfWidth, -halfHeight, -distance)
  };
}

function rectangleEdges(
  rectangle: FrustumRectangle
): THREE.Vector3[] {
  const { topLeft, topRight, bottomRight, bottomLeft } = rectangle;

  return [
    topLeft, topRight,
    topRight, bottomRight,
    bottomRight, bottomLeft,
    bottomLeft, topLeft
  ];
}

function upTriangle(
  rectangle: FrustumRectangle
): THREE.Vector3[] {
  const { topLeft, topRight, bottomRight } = rectangle;
  const halfWidth = topRight.x;
  const height = topRight.y - bottomRight.y;
  const baseY = topRight.y + height * kUpGapRatio;
  const z = topLeft.z;

  const left = new THREE.Vector3(-halfWidth * kUpHalfBaseRatio, baseY, z);
  const right = new THREE.Vector3(halfWidth * kUpHalfBaseRatio, baseY, z);
  const tip = new THREE.Vector3(0, baseY + height * kUpHeightRatio, z);

  return [
    left, right,
    right, tip,
    tip, left
  ];
}
