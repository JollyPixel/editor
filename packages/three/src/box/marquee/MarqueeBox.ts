// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import {
  BoxVolume,
  type BoxVolumeOptions
} from "../BoxVolume.ts";
import {
  MarqueeBoxEdges,
  type MarqueeBoxEdgesOptions,
  type MarqueeColors
} from "./MarqueeBoxEdges.ts";

export type MarqueeBoxDefaults = MarqueeBoxEdgesOptions;

export interface MarqueeBoxOptions extends BoxVolumeOptions {
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

export class MarqueeBox extends BoxVolume {
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

  constructor(
    options: MarqueeBoxOptions = {}
  ) {
    const defaults = MarqueeBox.Defaults;
    const {
      width = defaults.width,
      dashLength = defaults.dashLength,
      ratio = defaults.ratio,
      speed = defaults.speed,
      colors = defaults.colors,
      xray = defaults.xray
    } = options;

    super(options);

    this.edges = new MarqueeBoxEdges({
      width,
      dashLength,
      ratio,
      speed,
      colors,
      xray
    });
    this.add(this.edges);

    this.layout(this.copySizeTo());
  }

  protected override layout(
    size: THREE.Vector3
  ): void {
    this.edges.resize(size);
  }

  protected override release(): void {
    this.edges.dispose();
  }
}
