// Import Third-party Dependencies
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import {
  LineSegmentsGeometry
} from "three/addons/lines/LineSegmentsGeometry.js";
import { Line2NodeMaterial } from "three/webgpu";

// Import Internal Dependencies
import { boxOutlinePositions } from "../common/boxOutline.ts";

// CONSTANTS
const kTintTarget = new THREE.Color("#ffffff");
const kTintRatio = 0.4;
const kRenderOrder = 2;

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
        transparent: opacity < 1,
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
    size: THREE.Vector3Like
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
      boxOutlinePositions(size)
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

  override dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.geometry.dispose();
    this.material.dispose();
  }

  #applyEmphasis(): void {
    const opacity = Math.min(
      this.#opacity * this.#emphasisOpacity,
      1
    );

    this.material.opacity = opacity;
    this.#setTransparent(opacity < 1);
    this.material.color.copy(this.#color).lerp(
      kTintTarget,
      this.#tint * kTintRatio
    );
  }

  #setTransparent(
    transparent: boolean
  ): void {
    if (this.material.transparent === transparent) {
      return;
    }

    this.material.transparent = transparent;
    this.material.needsUpdate = true;
  }
}
