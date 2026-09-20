// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  BoxVolume,
  type BoxVolumeOptions
} from "../BoxVolume.ts";
import type { BoxState } from "../types.ts";
import { AreaBoxFill } from "./AreaBoxFill.ts";
import { AreaBoxEdges } from "./AreaBoxEdges.ts";
import { AreaBoxLabel } from "./AreaBoxLabel.ts";

// CONSTANTS
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

const _size = new THREE.Vector3();

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

export interface AreaBoxOptions extends BoxVolumeOptions {
  color?: THREE.ColorRepresentation;
  opacity?: number;
  edges?: Partial<AreaBoxEdgesDefaults>;
  shadeFaces?: boolean;
  displayName?: string;
}

/**
 * Translucent axis-aligned volume anchored at its min corner.
 */
export class AreaBox extends BoxVolume {
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

  constructor(
    options: AreaBoxOptions = {}
  ) {
    const defaults = AreaBox.Defaults;
    const {
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

    super(options);

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

    if (displayName !== undefined) {
      this.label = new AreaBoxLabel({ displayName });
      this.add(this.label);
    }

    this.layout(this.copySizeTo(_size));
  }

  get color(): THREE.Color {
    return this.fill.color;
  }

  set color(
    color: THREE.ColorRepresentation
  ) {
    this.fill.color = color;
    if (this.edges) {
      this.edges.color = color;
    }
  }

  protected override layout(
    size: THREE.Vector3
  ): void {
    const { x, y, z } = size;

    this.fill.resize(size);
    this.edges?.resize(size);
    this.label?.position.set(
      x / 2,
      y + kLabelClearance,
      z / 2
    );
  }

  protected override emphasize(
    state: BoxState
  ): void {
    const { opacity, tint } = kStateEmphasis[state];

    this.fill.emphasize(opacity, tint);
    this.edges?.emphasize(opacity, tint);
  }

  protected override release(): void {
    this.fill.dispose();
    this.edges?.dispose();
    this.label?.dispose();
  }
}
