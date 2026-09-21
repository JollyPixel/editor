// Import Third-party Dependencies
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import { Line2NodeMaterial } from "three/webgpu";

// Import Internal Dependencies
import { BoxEdgesGeometry } from "../BoxEdgesGeometry.ts";

// CONSTANTS
const kTintTarget = new THREE.Color("#ffffff");
const kTintRatio = 0.4;
const kRenderOrder = 2;
const kDepthBias = 2;

export interface AreaBoxEdgesOptions {
  color: THREE.ColorRepresentation;
  width: number;
  opacity: number;
}

/**
 * Twelve fat-line segments tracing the area
 */
export class AreaBoxEdges extends LineSegments2 {
  declare geometry: BoxEdgesGeometry;

  #opacity: number;
  #color: THREE.Color;
  #emphasisOpacity = 1;
  #tint = 0;
  #disposed = false;

  constructor(
    options: AreaBoxEdgesOptions
  ) {
    const { color, width, opacity } = options;

    super(
      new BoxEdgesGeometry(),
      new Line2NodeMaterial({
        color,
        linewidth: width,
        transparent: opacity < 1,
        opacity,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -kDepthBias,
        polygonOffsetUnits: -kDepthBias
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
    this.geometry.resize(size);
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
