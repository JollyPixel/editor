// Import Third-party Dependencies
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import {
  LineSegmentsGeometry
} from "three/addons/lines/LineSegmentsGeometry.js";
import { Line2NodeMaterial } from "three/webgpu";

// Import Internal Dependencies
import type { Vector3Like } from "../types.ts";

// CONSTANTS
const kTintTarget = new THREE.Color("#ffffff");
const kTintRatio = 0.4;
const kRenderOrder = 2;

const kEdgePairs: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7]
];

export interface AreaBoxEdgesOptions {
  color: THREE.ColorRepresentation;
  width: number;
  opacity: number;
}

/**
 * Twelve fat-line segments tracing the area
 */
export class AreaBoxEdges extends LineSegments2 {
  #opacity: number;
  #color: THREE.Color;
  #size: THREE.Vector3 | null = null;
  #emphasisOpacity = 1;
  #tint = 0;
  #disposed = false;

  constructor(
    options: AreaBoxEdgesOptions
  ) {
    const { color, width, opacity } = options;

    super(
      new LineSegmentsGeometry(),
      new Line2NodeMaterial({
        color,
        linewidth: width,
        transparent: true,
        opacity,
        depthWrite: false
      })
    );

    this.#opacity = opacity;
    this.#color = new THREE.Color(color);
    this.frustumCulled = false;
    this.renderOrder = kRenderOrder;
  }

  resize(
    size: Vector3Like
  ): void {
    if (
      this.#size !== null &&
      this.#size.x === size.x &&
      this.#size.y === size.y &&
      this.#size.z === size.z
    ) {
      return;
    }

    this.#size = new THREE.Vector3(
      size.x,
      size.y,
      size.z
    );
    this.geometry.setPositions(
      outlinePositions(size)
    );
    this.geometry.computeBoundingBox();
    this.geometry.computeBoundingSphere();
  }

  get color(): THREE.Color {
    return this.#color.clone();
  }

  set color(
    color: THREE.ColorRepresentation
  ) {
    this.#color.set(color);
    this.#applyEmphasis();
  }

  emphasize(
    opacity: number,
    tint: number
  ): void {
    this.#emphasisOpacity = opacity;
    this.#tint = tint;
    this.#applyEmphasis();
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.geometry.dispose();
    this.material.dispose();
  }

  #applyEmphasis(): void {
    this.material.opacity = Math.min(
      this.#opacity * this.#emphasisOpacity,
      1
    );
    this.material.color.copy(this.#color).lerp(
      kTintTarget,
      this.#tint * kTintRatio
    );
  }
}

function outlinePositions(
  size: Vector3Like
): number[] {
  const { x, y, z } = size;
  const corners: readonly (readonly [number, number, number])[] = [
    [0, 0, 0], [x, 0, 0], [x, 0, z], [0, 0, z],
    [0, y, 0], [x, y, 0], [x, y, z], [0, y, z]
  ];

  return kEdgePairs.flatMap(
    ([from, to]) => [
      ...corners[from],
      ...corners[to]
    ]
  );
}
