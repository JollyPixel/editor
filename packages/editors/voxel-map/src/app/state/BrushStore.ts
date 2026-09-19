// Import Third-party Dependencies
import type { VoxelRotation } from "@jolly-pixel/voxel.renderer";
import { EditorStore } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import {
  DEFAULT_BRUSH_STYLE,
  brushStyleEquals,
  brushStyleFrom,
  type BrushStyle
} from "../../features/painting/model/BrushStyle.ts";
import type {
  BrushAxis,
  BrushPattern
} from "../../features/painting/model/brushFootprint.ts";

// CONSTANTS
export const BRUSH_MIN_SIZE = 1;
export const BRUSH_MAX_SIZE = 16;

export type RotationMode = typeof VoxelRotation[keyof typeof VoxelRotation] | "auto";
export type BrushMode = "build" | "replace";

export type BrushStoreEvents = {
  blockChange: (id: number) => void;
  sizeChange: (size: number) => void;
  styleChange: (style: BrushStyle) => void;
  rotationModeChange: (mode: RotationMode) => void;
  flipYChange: (flipY: boolean) => void;
  modeChange: (mode: BrushMode) => void;
  axisChange: (axis: BrushAxis) => void;
  patternChange: (pattern: BrushPattern) => void;
  ghostChange: (ghost: boolean) => void;
};

export class BrushStore extends EditorStore<BrushStoreEvents> {
  #blockId = 1;
  #size = 1;
  #style: BrushStyle = DEFAULT_BRUSH_STYLE;
  #rotationMode: RotationMode = "auto";
  #flipY = false;
  #mode: BrushMode = "build";
  #axis: BrushAxis = "xz";
  #pattern: BrushPattern = "square";
  #ghost = false;

  get blockId(): number {
    return this.#blockId;
  }

  set blockId(id: number) {
    if (this.#blockId === id) {
      return;
    }
    this.#blockId = id;
    this.emit("blockChange", id);
  }

  get size(): number {
    return this.#size;
  }

  set size(
    size: number
  ) {
    const next = Math.max(
      BRUSH_MIN_SIZE,
      Math.min(BRUSH_MAX_SIZE, size)
    );
    if (this.#size === next) {
      return;
    }

    this.#size = next;
    this.emit(
      "sizeChange",
      next
    );
  }

  get style(): BrushStyle {
    return this.#style;
  }

  get rotationMode(): RotationMode {
    return this.#rotationMode;
  }

  set rotationMode(
    mode: RotationMode
  ) {
    if (this.#rotationMode === mode) {
      return;
    }

    this.#rotationMode = mode;
    this.emit(
      "rotationModeChange",
      mode
    );
  }

  get flipY(): boolean {
    return this.#flipY;
  }

  set flipY(flipY: boolean) {
    if (this.#flipY === flipY) {
      return;
    }

    this.#flipY = flipY;
    this.emit(
      "flipYChange",
      flipY
    );
  }

  get mode(): BrushMode {
    return this.#mode;
  }

  set mode(
    mode: BrushMode
  ) {
    if (this.#mode === mode) {
      return;
    }

    this.#mode = mode;
    this.emit(
      "modeChange",
      mode
    );
  }

  get axis(): BrushAxis {
    return this.#axis;
  }

  set axis(
    axis: BrushAxis
  ) {
    if (this.#axis === axis) {
      return;
    }

    this.#axis = axis;
    this.emit(
      "axisChange",
      axis
    );
  }

  get pattern(): BrushPattern {
    return this.#pattern;
  }

  set pattern(
    pattern: BrushPattern
  ) {
    if (this.#pattern === pattern) {
      return;
    }

    this.#pattern = pattern;
    this.emit(
      "patternChange",
      pattern
    );
  }

  get ghost(): boolean {
    return this.#ghost;
  }

  set ghost(
    ghost: boolean
  ) {
    if (this.#ghost === ghost) {
      return;
    }

    this.#ghost = ghost;
    this.emit(
      "ghostChange",
      ghost
    );
  }

  resize(
    delta: number
  ): void {
    this.size = this.#size + delta;
  }

  applyStyle(
    patch: Partial<BrushStyle>
  ): void {
    const next = brushStyleFrom(
      patch,
      this.#style
    );
    if (brushStyleEquals(this.#style, next)) {
      return;
    }

    this.#style = next;
    this.emit(
      "styleChange",
      next
    );
  }
}
