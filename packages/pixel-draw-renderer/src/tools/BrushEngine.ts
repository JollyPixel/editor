// Import Third-party Dependencies
import { formatHex8 } from "@jolly-pixel/color";

// Import Internal Dependencies
import { Stroke } from "./Stroke.ts";
import type {
  Brush,
  BrushColorSlot,
  BrushPaintSource
} from "./Brush.ts";
import type { CanvasBuffer } from "../buffer/CanvasBuffer.ts";
import type { PixelDocument } from "../PixelDocument.ts";
import type {
  PeerStrokePixel,
  RGBA8
} from "../types.ts";

export interface BrushEngineOptions {
  brush: Brush;
  document: Pick<PixelDocument, "buffer" | "recordStroke">;
  canvas: HTMLCanvasElement;
  onProgress?: (pixels: PeerStrokePixel[]) => void;
}

export interface BrushTool {
  pickArmed: boolean;
  pick(
    x: number,
    y: number,
    slot?: BrushColorSlot
  ): RGBA8 | null;
}

export class BrushEngine implements BrushTool {
  #brush: Brush;
  #canvasBuffer: CanvasBuffer;
  #canvas: HTMLCanvasElement;
  #document: Pick<PixelDocument, "recordStroke">;
  #onProgress?: (pixels: PeerStrokePixel[]) => void;

  #stroke: Stroke | null = null;
  #pickArmed = false;

  constructor(
    options: BrushEngineOptions
  ) {
    this.#brush = options.brush;
    this.#canvasBuffer = options.document.buffer;
    this.#canvas = options.canvas;
    this.#document = options.document;
    this.#onProgress = options.onProgress;
  }

  get pickArmed(): boolean {
    return this.#pickArmed;
  }

  set pickArmed(
    armed: boolean
  ) {
    this.#pickArmed = armed;
  }

  pick(
    tx: number,
    ty: number,
    slot: BrushColorSlot = "primary"
  ): RGBA8 | null {
    const size = this.#canvasBuffer.size();
    if (
      tx < 0 ||
      ty < 0 ||
      tx >= size.x ||
      ty >= size.y
    ) {
      return null;
    }

    const [color] = this.#canvasBuffer.samplePixels([{ x: tx, y: ty }]);
    const hex = formatHex8({ ...color, a: 255 });
    const opacity = color.a / 255;
    this.#brush[slot].set(hex, opacity);
    this.#pickArmed = false;

    const event = new CustomEvent("colorpicked", {
      detail: { hex, opacity, slot },
      bubbles: true,
      composed: true
    });
    this.#canvas.dispatchEvent(event);

    return color;
  }

  startStroke(
    tx: number,
    ty: number,
    source: BrushPaintSource
  ): void {
    this.endStroke();
    this.#stroke = new Stroke(
      source,
      this.#brush.colorFor(source)
    );
    this.#stamp(this.#stroke, tx, ty);
  }

  continueStroke(
    tx: number,
    ty: number
  ): void {
    if (this.#stroke) {
      this.#stamp(this.#stroke, tx, ty);
    }
  }

  endStroke(): BrushPaintSource | null {
    const stroke = this.#stroke;
    if (stroke === null) {
      return null;
    }

    this.#stroke = null;
    this.#canvasBuffer.copyToMaster();
    stroke.recordTo(this.#document);
    this.#onProgress?.([]);

    return stroke.source;
  }

  #stamp(
    stroke: Stroke,
    tx: number,
    ty: number
  ): void {
    const affected = [...this.#brush.affectedPixels(tx, ty)];
    stroke.cover(affected, this.#canvasBuffer);
    this.#canvasBuffer.drawPixels(affected, stroke.color);
    this.#onProgress?.(stroke.paintedPixels());
  }
}
