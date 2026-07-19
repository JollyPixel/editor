// Import Internal Dependencies
import { Fill } from "./Fill.ts";
import { toRGBA } from "../utils/colors.ts";
import type {
  Brush,
  BrushColorSlot
} from "./Brush.ts";
import type {
  CanvasBuffer
} from "../buffer/CanvasBuffer.ts";
import type {
  RGBA,
  Vec2
} from "../types.ts";

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
    * Commits a contiguous fill.
   */
  onCommit: (pixels: Vec2[], slot: BrushColorSlot) => void;
  /**
    * Commits a global fill.
   */
  onGlobalCommit: (commit: FillGlobalCommit) => void;
}

/**
 * Runs contiguous and global fills.
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
