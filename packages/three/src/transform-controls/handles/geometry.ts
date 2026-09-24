// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type ArrowGeometry,
  createArrowGeometry,
  createArrowShaftGeometry
} from "../../common/arrowGeometry.ts";
import { mergePositions } from "../../common/mergePositions.ts";
import type { ResolvedRings } from "../appearance.ts";
import type { TransformAxisHandleOptions } from "../types.ts";
import {
  positive,
  segments
} from "../validation.ts";

// CONSTANTS
const kDefaultShaft: ShaftDimensions = {
  shaftLength: 0.85,
  shaftRadius: 0.028,
  radialSegments: 16
};
const kDefaultHeadLength = 0.3;
const kDefaultHeadRadius = 0.11;
const kDefaultSphereRadius = 0.1;
const kDefaultCubeSize = 0.18;
const kDefaultSlabSize = 0.22;

export type AxisHandleGeometry = ArrowGeometry;

interface ShaftDimensions {
  shaftLength: number;
  shaftRadius: number;
  radialSegments: number;
}

export function createAxisHandleGeometry(
  options: TransformAxisHandleOptions
): AxisHandleGeometry {
  switch (options.kind) {
    case "sphere":
      return createSphereHandleGeometry(options);
    case "cube":
      return createCubeHandleGeometry(options);
    case "slab":
      return createSlabHandleGeometry(options);
    default:
      return createArrowHandleGeometry(options);
  }
}

export function createPlaneHandleGeometry(
  inset: number,
  size: number
): THREE.PlaneGeometry {
  const center = inset + (size / 2);

  return new THREE.PlaneGeometry(size, size).translate(center, center, 0);
}

export function createPlaneBorderGeometry(
  inset: number,
  size: number,
  thickness: number
): THREE.BufferGeometry {
  const width = Math.min(thickness, size);
  const outer = inset + size;
  const along = size - width;
  const strips = [
    new THREE.PlaneGeometry(size, width).translate(
      inset + (size / 2),
      outer - (width / 2),
      0
    )
  ];
  if (along > 0) {
    strips.push(
      new THREE.PlaneGeometry(width, along).translate(
        outer - (width / 2),
        inset + (along / 2),
        0
      )
    );
  }

  const geometry = mergePositions(strips);
  for (const strip of strips) {
    strip.dispose();
  }

  return geometry;
}

export function createRingGeometry(
  radius: number,
  tube: number,
  rings: ResolvedRings
): THREE.TorusGeometry {
  return new THREE.TorusGeometry(
    radius,
    tube,
    rings.radialSegments,
    rings.tubularSegments
  );
}

function createArrowHandleGeometry(
  options: Extract<TransformAxisHandleOptions, { kind: "arrow"; }>
): AxisHandleGeometry {
  return createArrowGeometry({
    ...shaftDimensions(options),
    headLength: positive(
      options.headLength ?? kDefaultHeadLength,
      "handle headLength"
    ),
    headRadius: positive(
      options.headRadius ?? kDefaultHeadRadius,
      "handle headRadius"
    )
  });
}

function createSphereHandleGeometry(
  options: Extract<TransformAxisHandleOptions, { kind: "sphere"; }>
): AxisHandleGeometry {
  const dimensions = shaftDimensions(options);
  const radius = positive(
    options.radius ?? kDefaultSphereRadius,
    "handle radius"
  );
  const tip = new THREE.SphereGeometry(
    radius,
    dimensions.radialSegments,
    Math.max(4, Math.floor(dimensions.radialSegments / 2))
  ).translate(0, dimensions.shaftLength, 0);

  return {
    geometry: mergeShaftWith(tip, dimensions),
    length: dimensions.shaftLength + radius
  };
}

function createCubeHandleGeometry(
  options: Extract<TransformAxisHandleOptions, { kind: "cube"; }>
): AxisHandleGeometry {
  const dimensions = shaftDimensions(options);
  const size = positive(
    options.size ?? kDefaultCubeSize,
    "handle size"
  );
  const tip = new THREE.BoxGeometry(size, size, size)
    .translate(0, dimensions.shaftLength, 0);

  return {
    geometry: mergeShaftWith(tip, dimensions),
    length: dimensions.shaftLength + (size / 2)
  };
}

function createSlabHandleGeometry(
  options: Extract<TransformAxisHandleOptions, { kind: "slab"; }>
): AxisHandleGeometry {
  const dimensions = shaftDimensions(options);
  const size = positive(
    options.size ?? kDefaultSlabSize,
    "handle size"
  );
  const depth = positive(
    options.depth ?? (size / 2),
    "handle depth"
  );
  const tip = new THREE.BoxGeometry(size, depth, size)
    .translate(0, dimensions.shaftLength, 0);

  return {
    geometry: mergeShaftWith(tip, dimensions),
    length: dimensions.shaftLength + (depth / 2)
  };
}

function mergeShaftWith(
  tip: THREE.BufferGeometry,
  dimensions: ShaftDimensions
): THREE.BufferGeometry {
  const shaft = createArrowShaftGeometry(dimensions);
  const geometry = mergePositions([shaft, tip]);
  shaft.dispose();
  tip.dispose();

  return geometry;
}

function shaftDimensions(
  options: TransformAxisHandleOptions
): ShaftDimensions {
  const defaults = kDefaultShaft;

  return {
    shaftLength: positive(
      options.shaftLength ?? defaults.shaftLength,
      "handle shaftLength"
    ),
    shaftRadius: positive(
      options.shaftRadius ?? defaults.shaftRadius,
      "handle shaftRadius"
    ),
    radialSegments: segments(
      options.radialSegments ?? defaults.radialSegments,
      "handle radialSegments"
    )
  };
}
