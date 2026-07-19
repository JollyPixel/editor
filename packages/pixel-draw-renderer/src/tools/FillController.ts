// Import Internal Dependencies
import type { Brush, BrushColorSlot } from "./Brush.ts";
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
  /**
   * Commits a contiguous flood-fill region as an ordinary "stroke", painted
   * with the given color slot.
   */
  onCommit: (pixels: Vec2[], slot: BrushColorSlot) => void;
  /**
   * Commits a global fill (every pixel matching `fromColor` anywhere on the
   * canvas, recolored to `toColor`). `positions`/`beforeColors` are provided
   * for the caller's own local history bookkeeping — see PixelArtCanvas's
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
  #onCommit: (pixels: Vec2[], slot: BrushColorSlot) => void;
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

  set global(
    global: boolean
  ) {
    this.#global = global;
  }

  run(
    tx: number,
    ty: number,
    slot: BrushColorSlot = "primary"
  ): void {
    if (this.#global) {
      this.#runGlobal(tx, ty, slot);

      return;
    }

    const fillColor = toRGBA(this.#brush[slot].asString());
    const positions = Fill.floodFill(
      this.#canvasBuffer,
      { x: tx, y: ty },
      fillColor
    );
    this.#onCommit(positions, slot);
  }

  #runGlobal(
    tx: number,
    ty: number,
    slot: BrushColorSlot
  ): void {
    const [sr, sg, sb, sa] = this.#canvasBuffer.samplePixel(tx, ty);
    const fromColor: RGBA = {
      r: sr,
      g: sg,
      b: sb,
      a: sa
    };
    const toColor = toRGBA(this.#brush[slot].asString());

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
