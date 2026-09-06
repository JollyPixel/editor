// Import Third-party Dependencies
import type { VoxelRotation } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  DEFAULT_BRUSH_STYLE,
  brushStyleEquals,
  brushStyleFrom,
  type BrushStyle
} from "../../features/painting/model/BrushStyle.ts";
import { EditorStore } from "./EditorStore.ts";

// CONSTANTS
const kMinSize = 1;
const kMaxSize = 8;

export type RotationMode = typeof VoxelRotation[keyof typeof VoxelRotation] | "auto";

export type BrushStoreEvents = {
  blockChange: (id: number) => void;
  sizeChange: (size: number) => void;
  styleChange: (style: BrushStyle) => void;
  rotationModeChange: (mode: RotationMode) => void;
  flipYChange: (flipY: boolean) => void;
};

export class BrushStore extends EditorStore<BrushStoreEvents> {
  #blockId = 1;
  #size = 1;
  #style: BrushStyle = DEFAULT_BRUSH_STYLE;
  #rotationMode: RotationMode = "auto";
  #flipY = false;

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

  set size(size: number) {
    const next = Math.max(kMinSize, Math.min(kMaxSize, size));
    if (this.#size === next) {
      return;
    }
    this.#size = next;
    this.emit("sizeChange", next);
  }

  get style(): BrushStyle {
    return this.#style;
  }

  get rotationMode(): RotationMode {
    return this.#rotationMode;
  }

  set rotationMode(mode: RotationMode) {
    if (this.#rotationMode === mode) {
      return;
    }
    this.#rotationMode = mode;
    this.emit("rotationModeChange", mode);
  }

  get flipY(): boolean {
    return this.#flipY;
  }

  set flipY(flipY: boolean) {
    if (this.#flipY === flipY) {
      return;
    }
    this.#flipY = flipY;
    this.emit("flipYChange", flipY);
  }

  resize(delta: number): void {
    this.size = this.#size + delta;
  }

  applyStyle(
    patch: Partial<BrushStyle>
  ): void {
    const next = brushStyleFrom(patch, this.#style);
    if (brushStyleEquals(this.#style, next)) {
      return;
    }

    this.#style = next;
    this.emit("styleChange", next);
  }
}
