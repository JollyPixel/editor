// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { mergePositions } from "./mergePositions.ts";

// CONSTANTS
export const ARROW_GEOMETRY_DEFAULTS = {
  shaftLength: 0.75,
  shaftRadius: 0.045,
  headLength: 0.4,
  headRadius: 0.16,
  radialSegments: 10
} as const;

export interface ArrowGeometryOptions {
  shaftLength?: number;
  shaftRadius?: number;
  headLength?: number;
  headRadius?: number;
  radialSegments?: number;
}

export interface ArrowGeometry {
  geometry: THREE.BufferGeometry;
  length: number;
}

export function createArrowShaftGeometry(
  options: ArrowGeometryOptions = {}
): THREE.CylinderGeometry {
  const {
    shaftLength = ARROW_GEOMETRY_DEFAULTS.shaftLength,
    shaftRadius = ARROW_GEOMETRY_DEFAULTS.shaftRadius,
    radialSegments = ARROW_GEOMETRY_DEFAULTS.radialSegments
  } = options;

  const shaft = new THREE.CylinderGeometry(
    shaftRadius,
    shaftRadius,
    shaftLength,
    radialSegments,
    1,
    false
  );
  shaft.translate(0, shaftLength / 2, 0);

  return shaft;
}

export function createArrowGeometry(
  options: ArrowGeometryOptions = {}
): ArrowGeometry {
  const {
    shaftLength = ARROW_GEOMETRY_DEFAULTS.shaftLength,
    headLength = ARROW_GEOMETRY_DEFAULTS.headLength,
    headRadius = ARROW_GEOMETRY_DEFAULTS.headRadius,
    radialSegments = ARROW_GEOMETRY_DEFAULTS.radialSegments
  } = options;

  const shaft = createArrowShaftGeometry(options);
  const head = new THREE.ConeGeometry(
    headRadius,
    headLength,
    radialSegments
  ).translate(0, shaftLength + (headLength / 2), 0);
  const geometry = mergePositions([shaft, head]);
  shaft.dispose();
  head.dispose();

  return {
    geometry,
    length: shaftLength + headLength
  };
}
