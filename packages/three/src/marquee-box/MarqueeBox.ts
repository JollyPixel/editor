// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  MarqueeBoxEdges,
  type MarqueeBoxEdgesOptions,
  type MarqueeColors
} from "./MarqueeBoxEdges.ts";

// CONSTANTS
const kMinimumExtent = 1e-6;

export type MarqueeBoxDefaults = MarqueeBoxEdgesOptions;

export interface MarqueeBoxOptions {
  /**
   * Extent along each axis, in world units.
   * @default { x: 1, y: 1, z: 1 }
   */
  size?: THREE.Vector3Like;
  /**
   * Min corner of the box.
   * @default { x: 0, y: 0, z: 0 }
   */
  position?: THREE.Vector3Like;
  /**
   * Line width in CSS pixels.
   * @default 2
   */
  width?: number;
  /**
   * World length of one dash plus one gap. Each ring and each vertical edge
   * rounds it so that it holds a whole number of them.
   * @default 0.5
   */
  dashLength?: number;
  /**
   * Share of `dashLength` drawn in the first color, from `0` to `1`.
   * @default 0.5
   */
  ratio?: number;
  /**
   * Dash lengths travelled per second. `0` freezes the pattern and a
   * negative value reverses it.
   * @default 1.5
   */
  speed?: number;
  /**
   * Dash color, then gap color.
   * @default ["#ffffff", "#000000"]
   */
  colors?: MarqueeColors;
  /**
   * Draws the edges through other geometry.
   * @default false
   */
  xray?: boolean;
}

export class MarqueeBox extends THREE.Object3D {
  static readonly Defaults: MarqueeBoxDefaults = {
    width: 2,
    dashLength: 0.5,
    ratio: 0.5,
    speed: 1.5,
    colors: ["#ffffff", "#000000"],
    xray: false
  };

  override readonly type = "MarqueeBox";

  readonly edges: MarqueeBoxEdges;

  #size = new THREE.Vector3(1, 1, 1);
  #disposed = false;

  constructor(
    options: MarqueeBoxOptions = {}
  ) {
    const defaults = MarqueeBox.Defaults;
    const {
      size,
      position,
      width = defaults.width,
      dashLength = defaults.dashLength,
      ratio = defaults.ratio,
      speed = defaults.speed,
      colors = defaults.colors,
      xray = defaults.xray
    } = options;

    super();

    this.edges = new MarqueeBoxEdges({
      width,
      dashLength,
      ratio,
      speed,
      colors,
      xray
    });
    this.add(this.edges);

    if (position) {
      this.position.set(
        position.x,
        position.y,
        position.z
      );
    }

    this.size = size ?? this.#size;
  }

  get size(): THREE.Vector3 {
    return this.#size.clone();
  }

  set size(
    size: THREE.Vector3Like
  ) {
    this.#size.set(
      Math.max(size.x, kMinimumExtent),
      Math.max(size.y, kMinimumExtent),
      Math.max(size.z, kMinimumExtent)
    );
    this.edges.resize(this.#size);
  }

  copySizeTo(
    target = new THREE.Vector3()
  ): THREE.Vector3 {
    return target.copy(this.#size);
  }

  get min(): THREE.Vector3 {
    return this.position;
  }

  toBox3(
    target = new THREE.Box3()
  ): THREE.Box3 {
    target.min.copy(this.position);
    target.max.copy(this.position).add(this.#size);

    return target;
  }

  fromBox3(
    box: THREE.Box3
  ): void {
    this.position.copy(box.min);
    this.size = {
      x: box.max.x - box.min.x,
      y: box.max.y - box.min.y,
      z: box.max.z - box.min.z
    };
  }

  override dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.edges.dispose();
  }
}
