// Import Internal Dependencies
import { Fill } from "./Fill.ts";
import type {
  Brush,
  BrushColorSlot
} from "./Brush.ts";
import type {
  CanvasBuffer
} from "../buffer/CanvasBuffer.ts";
import type { EditPipeline } from "../sync/EditPipeline.ts";
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

export interface FillEngineOptions {
  brush: Brush;
  canvasBuffer: CanvasBuffer;
  pipeline: EditPipeline;
}

export interface FillTool {
  /**
   * Recolors every matching pixel instead of only the contiguous region.
   */
  global: boolean;
}

export class FillEngine implements FillTool {
  #brush: Brush;
  #canvasBuffer: CanvasBuffer;
  #pipeline: EditPipeline;
  #global = false;

  constructor(
    options: FillEngineOptions
  ) {
    this.#brush = options.brush;
    this.#canvasBuffer = options.canvasBuffer;
    this.#pipeline = options.pipeline;
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
      this.#runGlobal(
        tx,
        ty,
        slot
      );

      return;
    }

    const [r, g, b, a] = this.#canvasBuffer.samplePixel(
      tx,
      ty
    );
    const beforeColor = { r, g, b, a };
    const fillColor = this.#brush[slot].asRGBA();
    const positions = Fill.floodFill(
      this.#canvasBuffer,
      { x: tx, y: ty },
      fillColor
    );
    this.#pipeline.commitPixels(
      positions,
      slot,
      beforeColor
    );
  }

  #runGlobal(
    tx: number,
    ty: number,
    slot: BrushColorSlot
  ): void {
    const [sr, sg, sb, sa] = this.#canvasBuffer.samplePixel(
      tx,
      ty
    );
    const fromColor: RGBA = {
      r: sr,
      g: sg,
      b: sb,
      a: sa
    };
    const toColor = this.#brush[slot].asRGBA();

    if (
      fromColor.r === toColor.r &&
      fromColor.g === toColor.g &&
      fromColor.b === toColor.b &&
      fromColor.a === toColor.a
    ) {
      return;
    }

    const positions = Fill.matchAll(
      this.#canvasBuffer,
      fromColor
    );
    if (positions.length === 0) {
      return;
    }

    const beforeColors = positions.map(
      () => fromColor
    );
    this.#pipeline.commitGlobalFill({
      positions,
      beforeColors,
      fromColor,
      toColor
    });
  }
}
