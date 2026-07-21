// Import Internal Dependencies
import type { Brush, BrushColorSlot } from "./Brush.ts";
import type { CanvasBuffer } from "../buffer/CanvasBuffer.ts";
import type { CanvasRenderer } from "../rendering/CanvasRenderer.ts";
import type { EditPipeline } from "../sync/EditPipeline.ts";
import { rgbToHex, toRGBA } from "../utils/colors.ts";
import type { RGBA, Vec2 } from "../types.ts";

export interface BrushControllerOptions {
  brush: Brush;
  canvasBuffer: CanvasBuffer;
  renderer: CanvasRenderer;
  pipeline: EditPipeline;
}

/**
 * Applies brush strokes to the canvas.
 */
export class BrushController {
  #brush: Brush;
  #canvasBuffer: CanvasBuffer;
  #renderer: CanvasRenderer;
  #pipeline: EditPipeline;

  #strokeDirty = new Map<string, Vec2>();
  #strokeBefore = new Map<string, RGBA>();
  #strokeColor: RGBA | null = null;
  #activeSlot: BrushColorSlot | null = null;
  #pickArmed = false;

  constructor(
    options: BrushControllerOptions
  ) {
    this.#brush = options.brush;
    this.#canvasBuffer = options.canvasBuffer;
    this.#renderer = options.renderer;
    this.#pipeline = options.pipeline;
  }

  /**
   * Active brush color slot.
   */
  get isActive(): BrushColorSlot | false {
    return this.#activeSlot ?? false;
  }

  /**
   * Whether the next primary action picks a color.
   */
  get pickArmed(): boolean {
    return this.#pickArmed;
  }

  set pickArmed(
    armed: boolean
  ) {
    this.#pickArmed = armed;
  }

  /**
   * Samples a pixel into the primary brush color.
   */
  pick(
    tx: number,
    ty: number
  ): RGBA | null {
    const size = this.#canvasBuffer.size();
    if (tx < 0 || ty < 0 || tx >= size.x || ty >= size.y) {
      return null;
    }

    const [r, g, b, a] = this.#canvasBuffer.samplePixel(tx, ty);
    const hex = rgbToHex(r, g, b);
    const opacity = a / 255;
    this.#brush.primary.set(hex, opacity);
    this.#pickArmed = false;

    const event = new CustomEvent("colorpicked", {
      detail: { hex, opacity },
      bubbles: true,
      composed: true
    });
    this.#renderer.canvas().dispatchEvent(event);

    return { r, g, b, a };
  }

  /**
   * Starts a brush stroke.
   */
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

  /**
   * Commits the current brush stroke.
   */
  endStroke(): void {
    this.#canvasBuffer.copyToMaster();
    this.#commit();
    this.#activeSlot = null;
  }

  #stamp(
    tx: number,
    ty: number
  ): void {
    const rgba = toRGBA(
      this.#brush[this.#activeSlot ?? "primary"].asString()
    );

    const affected = [...this.#brush.affectedPixels(tx, ty)];
    for (const pixel of affected) {
      const key = `${pixel.x},${pixel.y}`;
      if (!this.#strokeDirty.has(key)) {
        const [r, g, b, a] = this.#canvasBuffer.samplePixel(pixel.x, pixel.y);
        this.#strokeBefore.set(key, { r, g, b, a });
      }
      this.#strokeDirty.set(key, pixel);
    }

    this.#canvasBuffer.drawPixels(affected, rgba);
    this.#renderer.drawFrame();

    this.#strokeColor ??= rgba;
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
