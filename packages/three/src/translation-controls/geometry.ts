// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { mergePositions } from "../common/mergePositions.ts";
import type { TranslationHandleOptions } from "./types.ts";

// CONSTANTS
const kShaftLength = 0.75;
const kShaftRadius = 0.045;
const kHeadLength = 0.4;
const kHeadRadius = 0.16;
const kRadialSegments = 10;

export interface TranslationHandleGeometry {
  geometry: THREE.BufferGeometry;
  length: number;
}

export function createTranslationHandleGeometry(
  options: TranslationHandleOptions
): TranslationHandleGeometry {
  return options.kind === "sphere"
    ? createSphereHandleGeometry(options)
    : createArrowHandleGeometry(options);
}

function createArrowHandleGeometry(
  options: Extract<TranslationHandleOptions, { kind: "arrow"; }>
): TranslationHandleGeometry {
  const shaftLength = positive(
    options.shaftLength ?? kShaftLength,
    "shaftLength"
  );
  const shaftRadius = positive(
    options.shaftRadius ?? kShaftRadius,
    "shaftRadius"
  );
  const headLength = positive(
    options.headLength ?? kHeadLength,
    "headLength"
  );
  const headRadius = positive(
    options.headRadius ?? kHeadRadius,
    "headRadius"
  );
  const radialSegments = segments(
    options.radialSegments ?? kRadialSegments
  );

  const shaft = new THREE.CylinderGeometry(
    shaftRadius,
    shaftRadius,
    shaftLength,
    radialSegments,
    1,
    false
  ).translate(0, shaftLength / 2, 0);
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

function createSphereHandleGeometry(
  options: Extract<TranslationHandleOptions, { kind: "sphere"; }>
): TranslationHandleGeometry {
  const shaftLength = positive(
    options.shaftLength ?? kShaftLength,
    "shaftLength"
  );
  const shaftRadius = positive(
    options.shaftRadius ?? kShaftRadius,
    "shaftRadius"
  );
  const radius = positive(options.radius ?? kHeadRadius, "radius");
  const radialSegments = segments(
    options.radialSegments ?? kRadialSegments
  );

  const shaft = new THREE.CylinderGeometry(
    shaftRadius,
    shaftRadius,
    shaftLength,
    radialSegments,
    1,
    false
  ).translate(0, shaftLength / 2, 0);
  const selector = new THREE.SphereGeometry(
    radius,
    radialSegments,
    Math.max(4, Math.floor(radialSegments / 2))
  ).translate(0, shaftLength, 0);
  const geometry = mergePositions([shaft, selector]);
  shaft.dispose();
  selector.dispose();

  return {
    geometry,
    length: shaftLength + radius
  };
}

function positive(
  value: number,
  label: string
): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(
      `Translation handle ${label} must be greater than zero`
    );
  }

  return value;
}

function segments(
  value: number
): number {
  if (!Number.isInteger(value) || value < 3) {
    throw new RangeError(
      "Translation handle radialSegments must be an integer of at least 3"
    );
  }

  return value;
}
