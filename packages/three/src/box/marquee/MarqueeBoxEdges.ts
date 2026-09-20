// Import Third-party Dependencies
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";

// Import Internal Dependencies
import { BoxEdgesGeometry } from "../BoxEdgesGeometry.ts";
import { BOX_EDGE_PAIRS } from "../boxOutline.ts";
import { marqueePhases } from "./marqueePhases.ts";
import {
  MARQUEE_PHASE_END,
  MARQUEE_PHASE_START,
  buildMarqueeMaterial,
  createMarqueeUniforms,
  type MarqueeUniforms
} from "./material.ts";

// CONSTANTS
const kRenderOrder = 2;
const kXrayRenderOrder = 999;
const kMinimumDashLength = 1e-3;
const kPhaseStride = 2;

const _size = new THREE.Vector3();

export type MarqueeColors = readonly [
  THREE.ColorRepresentation,
  THREE.ColorRepresentation
];

export interface MarqueeBoxEdgesOptions {
  /**
   * Line width in CSS pixels.
   */
  width: number;
  /**
   * World length of one dash plus one gap. Each ring and each vertical edge
   * rounds it so that it holds a whole number of them.
   */
  dashLength: number;
  /**
   * Share of `dashLength` drawn in the first color, from `0` to `1`.
   */
  ratio: number;
  /**
   * Dash lengths travelled per second. `0` freezes the pattern and a
   * negative value reverses it.
   */
  speed: number;
  /**
   * Dash color, then gap color.
   */
  colors: MarqueeColors;
  /**
   * Draws the edges through other geometry.
   */
  xray: boolean;
}

export class MarqueeBoxEdges extends LineSegments2 {
  declare geometry: BoxEdgesGeometry;

  readonly uniforms: MarqueeUniforms;

  #phases: THREE.InstancedInterleavedBuffer;
  #dashLength: number;
  #disposed = false;

  constructor(
    options: MarqueeBoxEdgesOptions
  ) {
    const { width, dashLength, ratio, speed, colors, xray } = options;

    const uniforms = createMarqueeUniforms({
      ratio: THREE.MathUtils.clamp(ratio, 0, 1),
      speed,
      colors
    });
    const phases = new THREE.InstancedInterleavedBuffer(
      new Float32Array(BOX_EDGE_PAIRS.length * kPhaseStride),
      kPhaseStride,
      1
    );

    const geometry = new BoxEdgesGeometry();
    geometry.setAttribute(
      MARQUEE_PHASE_START,
      new THREE.InterleavedBufferAttribute(phases, 1, 0)
    );
    geometry.setAttribute(
      MARQUEE_PHASE_END,
      new THREE.InterleavedBufferAttribute(phases, 1, 1)
    );

    super(
      geometry,
      buildMarqueeMaterial({ width, uniforms })
    );

    this.uniforms = uniforms;
    this.#phases = phases;
    this.#dashLength = Math.max(dashLength, kMinimumDashLength);
    this.frustumCulled = false;
    this.xray = xray;
    this.#writePhases();
  }

  resize(
    size: THREE.Vector3Like
  ): void {
    if (this.geometry.resize(size)) {
      this.#writePhases();
    }
  }

  get width(): number {
    return this.material.linewidth;
  }

  set width(
    width: number
  ) {
    this.material.linewidth = width;
  }

  get dashLength(): number {
    return this.#dashLength;
  }

  set dashLength(
    dashLength: number
  ) {
    this.#dashLength = Math.max(dashLength, kMinimumDashLength);
    this.#writePhases();
  }

  get ratio(): number {
    return this.uniforms.ratio.value;
  }

  set ratio(
    ratio: number
  ) {
    this.uniforms.ratio.value = THREE.MathUtils.clamp(ratio, 0, 1);
  }

  get speed(): number {
    return this.uniforms.speed.value;
  }

  set speed(
    speed: number
  ) {
    this.uniforms.speed.value = speed;
  }

  get colors(): [THREE.Color, THREE.Color] {
    return [
      this.uniforms.dashColor.value.clone(),
      this.uniforms.gapColor.value.clone()
    ];
  }

  set colors(
    colors: MarqueeColors
  ) {
    this.uniforms.dashColor.value.set(colors[0]);
    this.uniforms.gapColor.value.set(colors[1]);
  }

  get xray(): boolean {
    return !this.material.depthTest;
  }

  set xray(
    xray: boolean
  ) {
    this.material.depthTest = !xray;
    this.renderOrder = xray ? kXrayRenderOrder : kRenderOrder;
  }

  override dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.geometry.dispose();
    this.material.dispose();
  }

  #writePhases(): void {
    this.#phases.set(
      marqueePhases(
        this.geometry.copySizeTo(_size),
        this.#dashLength
      )
    );
    this.#phases.needsUpdate = true;
  }
}
