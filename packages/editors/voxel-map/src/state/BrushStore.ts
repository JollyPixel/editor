// Import Third-party Dependencies
import type { VoxelRotation } from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// CONSTANTS
export const BRUSH_MIN_SIZE = 1;
export const BRUSH_MAX_SIZE = 16;
export const BRUSH_AXES: readonly BrushAxis[] = Object.freeze([
  "xz",
  "xy",
  "yz",
  "xyz"
]);

export type BrushAxis = "xz" | "xy" | "yz" | "xyz";
export type BrushPattern = "square" | "circle";
export type RotationMode = typeof VoxelRotation[keyof typeof VoxelRotation] | "auto";
export type BrushMode = "build" | "replace";

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
  blockChange: (id: number) => void;
  change: (options: Readonly<BrushOptions>) => void;
};

export class BrushStore extends Emitter<BrushStoreEvents> {
  #blockId = 1;
  #options: Readonly<BrushOptions> = Object.freeze({
    size: 1,
    rotationMode: "auto",
    flipY: false,
    mode: "build",
    axis: "xz",
    pattern: "square",
    ghost: false
  });

  get blockId(): number {
    return this.#blockId;
  }

  set blockId(
    id: number
  ) {
    if (this.#blockId === id) {
      return;
    }

    this.#blockId = id;
    this.emit("blockChange", id);
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
