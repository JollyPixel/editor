// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  ARROW_GEOMETRY_DEFAULTS,
  type ArrowGeometry,
  createArrowGeometry,
  createArrowShaftGeometry
} from "../common/arrowGeometry.ts";
import { mergePositions } from "../common/mergePositions.ts";
import type { TranslationHandleOptions } from "./types.ts";

export type TranslationHandleGeometry = ArrowGeometry;

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
  const defaults = ARROW_GEOMETRY_DEFAULTS;

  return createArrowGeometry({
    shaftLength: positive(
      options.shaftLength ?? defaults.shaftLength,
      "shaftLength"
    ),
    shaftRadius: positive(
      options.shaftRadius ?? defaults.shaftRadius,
      "shaftRadius"
    ),
    headLength: positive(
      options.headLength ?? defaults.headLength,
      "headLength"
    ),
    headRadius: positive(
      options.headRadius ?? defaults.headRadius,
      "headRadius"
    ),
    radialSegments: segments(
      options.radialSegments ?? defaults.radialSegments
    )
  });
}

function createSphereHandleGeometry(
  options: Extract<TranslationHandleOptions, { kind: "sphere"; }>
): TranslationHandleGeometry {
  const defaults = ARROW_GEOMETRY_DEFAULTS;
  const shaftLength = positive(
    options.shaftLength ?? defaults.shaftLength,
    "shaftLength"
  );
  const shaftRadius = positive(
    options.shaftRadius ?? defaults.shaftRadius,
    "shaftRadius"
  );
  const radius = positive(
    options.radius ?? defaults.headRadius,
    "radius"
  );
  const radialSegments = segments(
    options.radialSegments ?? defaults.radialSegments
  );

  const shaft = createArrowShaftGeometry({
    shaftLength,
    shaftRadius,
    radialSegments
  });
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
