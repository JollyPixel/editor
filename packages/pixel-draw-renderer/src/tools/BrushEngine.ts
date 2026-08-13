// Import Internal Dependencies
import type { Brush, BrushColorSlot } from "./Brush.ts";
import type { CanvasBuffer } from "../buffer/CanvasBuffer.ts";
import type { EditPipeline } from "../sync/EditPipeline.ts";
import { rgbToHex } from "../utils/colors.ts";
import type { PeerStrokePixel, RGBA, Vec2 } from "../types.ts";

export interface BrushEngineOptions {
  brush: Brush;
  canvasBuffer: CanvasBuffer;
  /**
   * Dispatch target for the `colorpicked` event.
   */
  canvas: HTMLCanvasElement;
  pipeline: EditPipeline;
  /**
   * Receives live stroke pixels for peer streaming.
   */
  onProgress?: (pixels: PeerStrokePixel[]) => void;
}

export interface BrushTool {
  /**
   * Whether the next primary or secondary action picks a color instead of
   * painting.
   */
  pickArmed: boolean;
  pick(
    x: number,
    y: number,
    slot?: BrushColorSlot
  ): RGBA | null;
}

export class BrushEngine implements BrushTool {
  #brush: Brush;
  #canvasBuffer: CanvasBuffer;
  #canvas: HTMLCanvasElement;
  #pipeline: EditPipeline;
  #onProgress?: (pixels: PeerStrokePixel[]) => void;

  #strokeDirty = new Map<string, Vec2>();
  #strokeBefore = new Map<string, RGBA>();
  #strokeColor: RGBA | null = null;
  #activeSlot: BrushColorSlot | null = null;
  #pickArmed = false;

  constructor(
    options: BrushEngineOptions
  ) {
    this.#brush = options.brush;
    this.#canvasBuffer = options.canvasBuffer;
    this.#canvas = options.canvas;
    this.#pipeline = options.pipeline;
    this.#onProgress = options.onProgress;
  }

  get isActive(): BrushColorSlot | false {
    return this.#activeSlot ?? false;
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
  ): RGBA | null {
    const size = this.#canvasBuffer.size();
    if (tx < 0 || ty < 0 || tx >= size.x || ty >= size.y) {
      return null;
    }

    const [r, g, b, a] = this.#canvasBuffer.samplePixel(tx, ty);
    const hex = rgbToHex(r, g, b);
    const opacity = a / 255;
    this.#brush[slot].set(hex, opacity);
    this.#pickArmed = false;

    const event = new CustomEvent("colorpicked", {
      detail: { hex, opacity, slot },
      bubbles: true,
      composed: true
    });
    this.#canvas.dispatchEvent(event);

    return { r, g, b, a };
  }

  startStroke(
    tx: number,
    ty: number,
    slot: BrushColorSlot = "primary"
  ): void {
    this.#activeSlot = slot;
    this.#stamp(tx, ty);
  }

  continueStroke(
    tx: number,
    ty: number
  ): void {
    this.#stamp(tx, ty);
  }

  endStroke(): void {
    this.#canvasBuffer.copyToMaster();
    this.#commit();
    this.#activeSlot = null;
    // Drop the queued pre-commit ghost tick to prevent stale peer state.
    this.#onProgress?.([]);
  }

  #stamp(
    tx: number,
    ty: number
  ): void {
    const rgba = this.#brush[
      this.#activeSlot ?? "primary"
    ].asRGBA();

    const affected = [...this.#brush.affectedPixels(tx, ty)];
    for (const pixel of affected) {
      const key = `${pixel.x},${pixel.y}`;
      if (!this.#strokeDirty.has(key)) {
        const [r, g, b, a] = this.#canvasBuffer.samplePixel(
          pixel.x,
          pixel.y
        );
        this.#strokeBefore.set(key, { r, g, b, a });
      }
      this.#strokeDirty.set(key, pixel);
    }

    this.#canvasBuffer.drawPixels(affected, rgba);

    this.#strokeColor ??= rgba;
    this.#onProgress?.(this.#currentStrokePixels());
  }

  #currentStrokePixels(): PeerStrokePixel[] {
    const color = this.#strokeColor;
    if (!color) {
      return [];
    }

    return [...this.#strokeDirty.values()].map((pos) => {
      return { ...pos, color };
    });
  }

  #commit(): void {
    if (
      this.#strokeDirty.size === 0 ||
      this.#strokeColor === null
    ) {
      this.#strokeDirty.clear();
      this.#strokeBefore.clear();
      this.#strokeColor = null;

      return;
    }

    const positions = [...this.#strokeDirty.values()];
    const beforeColors = positions.map(
      (pixel) => this.#strokeBefore.get(`${pixel.x},${pixel.y}`)!
    );
    const color = this.#strokeColor;
    this.#strokeDirty.clear();
    this.#strokeBefore.clear();
    this.#strokeColor = null;

    this.#pipeline.commitStroke(positions, color, beforeColors);
  }
}
