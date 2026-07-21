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

export interface FillControllerOptions {
  brush: Brush;
  canvasBuffer: CanvasBuffer;
  pipeline: EditPipeline;
}

/**
 * Public fill-tool surface (`PixelArtCanvas.tools.fill`).
 */
export interface FillTool {
  /** Whether fills recolor every matching pixel, not just the contiguous region. */
  global: boolean;
}

/**
 * Runs contiguous and global fills.
 */
export class FillController implements FillTool {
  #brush: Brush;
  #canvasBuffer: CanvasBuffer;
  #pipeline: EditPipeline;
  #global = false;

  constructor(
    options: FillControllerOptions
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
      this.#runGlobal(tx, ty, slot);

      return;
    }

    const fillColor = toRGBA(this.#brush[slot].asString());
    const positions = Fill.floodFill(
      this.#canvasBuffer,
      { x: tx, y: ty },
      fillColor
    );
    this.#pipeline.commitPixels(positions, slot);
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
    this.#pipeline.commitGlobalFill({
      positions,
      beforeColors,
      fromColor,
      toColor
    });
  }
}
