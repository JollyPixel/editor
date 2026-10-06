// Import Third-party Dependencies
import {
  VoxelRotation,
  type VoxelRotationStep
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// CONSTANTS
export const BRUSH_MIN_SIZE = 1;
export const BRUSH_MAX_SIZE = 16;
export const BRUSH_AXES = Object.freeze([
  "xz",
  "xy",
  "yz",
  "xyz"
] as const);
export const BRUSH_PATTERNS = Object.freeze([
  "square",
  "circle"
] as const);
export const BRUSH_MODES = Object.freeze([
  "build",
  "replace"
] as const);
export const ROTATION_MODES: readonly RotationMode[] = Object.freeze([
  "auto",
  ...Object.values(VoxelRotation)
]);

export type BrushAxis = typeof BRUSH_AXES[number];
export type BrushPattern = typeof BRUSH_PATTERNS[number];
export type RotationMode = VoxelRotationStep | "auto";
export type BrushMode = typeof BRUSH_MODES[number];

export interface BrushOptions {
  size: number;
  rotationMode: RotationMode;
  flipY: boolean;
  mode: BrushMode;
  axis: BrushAxis;
  pattern: BrushPattern;
  ghost: boolean;
}

export type BrushStoreEvents = {
  change: (options: Readonly<BrushOptions>) => void;
  suspendedChange: (suspended: boolean) => void;
};

export class BrushStore extends Emitter<BrushStoreEvents> {
  #suspended = false;
  #options: Readonly<BrushOptions> = Object.freeze({
    size: 1,
    rotationMode: "auto",
    flipY: false,
    mode: "build",
    axis: "xz",
    pattern: "square",
    ghost: false
  });

  get suspended(): boolean {
    return this.#suspended;
  }

  set suspended(
    suspended: boolean
  ) {
    if (this.#suspended === suspended) {
      return;
    }

    this.#suspended = suspended;
    this.emit("suspendedChange", suspended);
  }

  get size(): number {
    return this.#options.size;
  }

  set size(
    size: number
  ) {
    this.#assign("size", Math.max(BRUSH_MIN_SIZE, Math.min(BRUSH_MAX_SIZE, size)));
  }

  get rotationMode(): RotationMode {
    return this.#options.rotationMode;
  }

  set rotationMode(
    mode: RotationMode
  ) {
    this.#assign("rotationMode", mode);
  }

  get flipY(): boolean {
    return this.#options.flipY;
  }

  set flipY(
    flipY: boolean
  ) {
    this.#assign("flipY", flipY);
  }

  get mode(): BrushMode {
    return this.#options.mode;
  }

  set mode(
    mode: BrushMode
  ) {
    this.#assign("mode", mode);
  }

  get axis(): BrushAxis {
    return this.#options.axis;
  }

  set axis(
    axis: BrushAxis
  ) {
    this.#assign("axis", axis);
  }

  get pattern(): BrushPattern {
    return this.#options.pattern;
  }

  set pattern(
    pattern: BrushPattern
  ) {
    this.#assign("pattern", pattern);
  }

  get ghost(): boolean {
    return this.#options.ghost;
  }

  set ghost(
    ghost: boolean
  ) {
    this.#assign("ghost", ghost);
  }

  resize(
    delta: number
  ): void {
    this.size += delta;
  }

  #assign<TKey extends keyof BrushOptions>(
    key: TKey,
    value: BrushOptions[TKey]
  ): void {
    if (this.#options[key] === value) {
      return;
    }

    this.#options = Object.freeze({
      ...this.#options,
      [key]: value
    });
    this.emit("change", this.#options);
  }
}
