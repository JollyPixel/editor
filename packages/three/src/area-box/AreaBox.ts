// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { AreaBoxFill } from "./AreaBoxFill.ts";
import { AreaBoxEdges } from "./AreaBoxEdges.ts";
import { AreaBoxLabel } from "./AreaBoxLabel.ts";
import type { AreaBoxState } from "./types.ts";
import type { Vector3Like } from "../types.ts";

// CONSTANTS
const kMinimumExtent = 1e-6;
const kLabelClearance = 0.4;

const kStateEmphasis = {
  idle: {
    opacity: 1,
    tint: 0
  },
  hovered: {
    opacity: 1.02,
    tint: 0.12
  },
  active: {
    opacity: 1.05,
    tint: 0.24
  }
} as const;

export interface AreaBoxEdgesDefaults {
  show: boolean;
  width: number;
  opacity: number;
}

export interface AreaBoxDefaults {
  color: THREE.ColorRepresentation;
  opacity: number;
  edges: AreaBoxEdgesDefaults;
  shadeFaces: boolean;
}

export interface AreaBoxOptions {
  size?: Vector3Like;
  position?: Vector3Like;
  color?: THREE.ColorRepresentation;
  opacity?: number;
  edges?: Partial<AreaBoxEdgesDefaults>;
  shadeFaces?: boolean;
  displayName?: string;
}

/**
 * Translucent axis-aligned volume anchored at its min corner.
 */
export class AreaBox extends THREE.Object3D {
  static readonly Defaults: AreaBoxDefaults = {
    color: "#4da3ff",
    opacity: 0.75,
    edges: {
      show: true,
      width: 2,
      opacity: 1
    },
    shadeFaces: true
  };

  override readonly type = "AreaBox";

  readonly fill: AreaBoxFill;
  readonly edges: AreaBoxEdges | null;

  label: AreaBoxLabel | null = null;

  #size = new THREE.Vector3(1, 1, 1);
  #state: AreaBoxState = "idle";

  constructor(
    options: AreaBoxOptions = {}
  ) {
    const defaults = AreaBox.Defaults;
    const {
      size,
      position,
      color = defaults.color,
      opacity = defaults.opacity,
      shadeFaces = defaults.shadeFaces,
      edges = {},
      displayName
    } = options;
    const {
      show: showEdges = defaults.edges.show,
      width: edgeWidth = defaults.edges.width,
      opacity: edgeOpacity = defaults.edges.opacity
    } = edges;

    super();

    this.fill = new AreaBoxFill({
      color,
      opacity,
      shadeFaces
    });
    this.add(this.fill);

    this.edges = showEdges
      ? new AreaBoxEdges({
        color,
        width: edgeWidth,
        opacity: edgeOpacity
      })
      : null;
    if (this.edges) {
      this.add(this.edges);
    }

    if (position) {
      this.position.set(
        position.x,
        position.y,
        position.z
      );
    }
    if (displayName !== undefined) {
      this.label = new AreaBoxLabel({ displayName });
      this.add(this.label);
    }

    this.size = size ?? this.#size;
  }

  get size(): THREE.Vector3 {
    return this.#size.clone();
  }

  set size(
    size: Vector3Like
  ) {
    this.#size.set(
      Math.max(size.x, kMinimumExtent),
      Math.max(size.y, kMinimumExtent),
      Math.max(size.z, kMinimumExtent)
    );
    this.#layout();
  }

  copySizeTo(
    target = new THREE.Vector3()
  ): THREE.Vector3 {
    return target.copy(this.#size);
  }

  get min(): THREE.Vector3 {
    return this.position;
  }

  get state(): AreaBoxState {
    return this.#state;
  }

  set state(
    state: AreaBoxState
  ) {
    if (state === this.#state) {
      return;
    }

    this.#state = state;
    const { opacity, tint } = kStateEmphasis[state];

    this.fill.emphasize(opacity, tint);
    this.edges?.emphasize(opacity, tint);
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

  dispose(): void {
    this.fill.dispose();
    this.edges?.dispose();
    this.label?.dispose();
  }

  #layout(): void {
    const { x, y, z } = this.#size;

    this.fill.resize(this.#size);
    this.edges?.resize(this.#size);
    this.label?.position.set(
      x / 2,
      y + kLabelClearance,
      z / 2
    );
  }
}
