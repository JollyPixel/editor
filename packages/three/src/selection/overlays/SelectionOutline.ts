// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { inflateEdgesGeometry } from "./inflateEdgesGeometry.ts";

// CONSTANTS
const kOffsetFactor = 0.006;
const kXrayRenderOrder = 999;
const kDashSizeFactor = 0.06;
const kGapSizeFactor = 0.04;

export interface SelectionOutlineOptions {
  /**
   * Mesh to outline. The overlay is attached to it.
   */
  target: THREE.Mesh;
  /**
   * @default "#ffffff"
   */
  color?: THREE.ColorRepresentation;
  /**
   * Line opacity.
   * @default 1
   */
  opacity?: number;
  /**
   * Line width in CSS pixels. Most WebGL backends clamp it to `1`.
   * @default 1
   */
  linewidth?: number;
  /**
   * Draws the outline through other geometry.
   * @default false
   */
  xray?: boolean;
  /**
   * Uses dashed lines scaled to the target's bounding sphere.
   * @default false
   */
  dashed?: boolean;
}

/**
 * Draws a mesh's edges without modifying its material.
 */
export class SelectionOutline extends THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  constructor(
    options: SelectionOutlineOptions
  ) {
    const {
      target,
      color = "#ffffff",
      opacity = 1,
      linewidth = 1,
      xray = false,
      dashed = false
    } = options;

    target.geometry.computeBoundingSphere();
    const radius = target.geometry.boundingSphere?.radius ?? 1;
    const offset = radius * kOffsetFactor;
    const geometry = inflateEdgesGeometry(
      target.geometry,
      offset
    );

    const material = dashed ?
      new THREE.LineDashedMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        linewidth,
        depthTest: !xray,
        depthWrite: !xray,
        dashSize: radius * kDashSizeFactor,
        gapSize: radius * kGapSizeFactor
      }) :
      new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        linewidth,
        depthTest: !xray,
        depthWrite: !xray
      });

    super(geometry, material);

    if (dashed) {
      this.computeLineDistances();
    }

    this.renderOrder = xray ? kXrayRenderOrder : 1;
    target.add(this);
  }

  get color(): THREE.Color {
    return this.material.color.clone();
  }

  set color(
    color: THREE.ColorRepresentation
  ) {
    this.material.color.set(color);
  }

  get opacity(): number {
    return this.material.opacity;
  }

  set opacity(
    opacity: number
  ) {
    this.material.opacity = opacity;
    this.material.transparent = opacity < 1;
  }

  get linewidth(): number {
    return this.material.linewidth;
  }

  set linewidth(
    linewidth: number
  ) {
    this.material.linewidth = linewidth;
  }

  get xray(): boolean {
    return !this.material.depthTest;
  }

  set xray(
    xray: boolean
  ) {
    this.material.depthTest = !xray;
    this.material.depthWrite = !xray;
    this.renderOrder = xray ? kXrayRenderOrder : 1;
  }

  dispose(): void {
    this.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
