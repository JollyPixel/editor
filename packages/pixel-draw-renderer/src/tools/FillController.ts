// Import Internal Dependencies
import type { Brush } from "./Brush.ts";
import { Fill } from "./Fill.ts";
import type { CanvasBuffer } from "../buffer/CanvasBuffer.ts";
import { toRGBA } from "../utils/colors.ts";
import type { RGBA, Vec2 } from "../types.ts";

export interface FillGlobalCommit {
  positions: Vec2[];
  beforeColors: RGBA[];
  fromColor: RGBA;
  toColor: RGBA;
}

export interface FillControllerOptions {
  brush: Brush;
  canvasBuffer: CanvasBuffer;
  /** Commits a contiguous flood-fill region as an ordinary "stroke". */
  onCommit: (pixels: Vec2[]) => void;
  /**
   * Commits a global fill (every pixel matching `fromColor` anywhere on the
   * canvas, recolored to `toColor`). `positions`/`beforeColors` are provided
   * for the caller's own local history bookkeeping — see CanvasManager's
   * "global-fill" hook, which is deliberately compact and carries neither.
   */
  onGlobalCommit: (commit: FillGlobalCommit) => void;
}

/**
 * Glues the Fill algorithms (pure, DOM-free) to the brush color and the
 * host's commit path, and owns the runtime-only contiguous/global toggle —
 * mirroring BrushController/LineController/SelectController.
 */
export class FillController {
  #brush: Brush;
  #canvasBuffer: CanvasBuffer;
  #onCommit: (pixels: Vec2[]) => void;
  #onGlobalCommit: (commit: FillGlobalCommit) => void;
  #global = false;

  constructor(
    options: FillControllerOptions
  ) {
    this.#brush = options.brush;
    this.#canvasBuffer = options.canvasBuffer;
    this.#onCommit = options.onCommit;
    this.#onGlobalCommit = options.onGlobalCommit;
  }

  get global(): boolean {
    return this.#global;
  }

  setGlobal(
    global: boolean
  ): void {
    this.#global = global;
  }

  run(
    tx: number,
    ty: number
  ): void {
    if (this.#global) {
      this.#runGlobal(tx, ty);

      return;
    }

    const fillColor = toRGBA(this.#brush.getColor());
    const positions = Fill.floodFill(
      this.#canvasBuffer,
      { x: tx, y: ty },
      fillColor
    );
    this.#onCommit(positions);
  }

  #runGlobal(
    tx: number,
    ty: number
  ): void {
    const [sr, sg, sb, sa] = this.#canvasBuffer.samplePixel(tx, ty);
    const fromColor: RGBA = {
      r: sr,
      g: sg,
      b: sb,
      a: sa
    };
    const toColor = toRGBA(this.#brush.getColor());

    if (
      fromColor.r === toColor.r &&
      fromColor.g === toColor.g &&
      fromColor.b === toColor.b &&
      fromColor.a === toColor.a
    ) {
      return;
    }

    const positions = Fill.matchAll(this.#canvasBuffer, fromColor);
    if (positions.length === 0) {
      return;
    }

    const beforeColors = positions.map(() => fromColor);
    this.#onGlobalCommit({
      positions,
      beforeColors,
      fromColor,
      toColor
    });
  }
}
