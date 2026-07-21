// Import Internal Dependencies
import { TypedEventEmitter } from "../../utils/EventEmitter.ts";
import type {
  RGBA,
  SelectionRect
} from "../../types.ts";

export interface FloatingOverlayOptions {
  /**
   * Original selection position.
   */
  sourceRect: SelectionRect;
  /**
   * Row-major selection pixels.
   */
  pixels: RGBA[];
  /**
   * Row-major selection mask.
   */
  mask?: boolean[];
  eraseColor: RGBA;
  /**
   * Whether to erase the source while dragging.
   * @default true
   */
  blankSource?: boolean;
}

/**
 * Fired after the floating selection appears, moves, or clears — a view
 * change the pixel buffer knows nothing about, so the view repaints on it.
 */
export type FloatingSelectionEvent = { type: "changed"; };

/**
 * Renders a floating selection overlay.
 */
export class FloatingSelectionOverlay extends TypedEventEmitter<
  FloatingSelectionEvent
> {
  #canvas: HTMLCanvasElement | null = null;
  #eraseCanvas: HTMLCanvasElement | null = null;
  #eraseIsUniform = true;
  #sourceRect: SelectionRect | null = null;
  #liveRect: SelectionRect | null = null;
  #blankSource: boolean = true;

  create(
    options: FloatingOverlayOptions
  ): void {
    const { sourceRect, pixels, mask, eraseColor, blankSource = true } = options;

    const canvas = document.createElement("canvas");
    canvas.width = sourceRect.width;
    canvas.height = sourceRect.height;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    const imageData = ctx.createImageData(sourceRect.width, sourceRect.height);
    for (let i = 0; i < pixels.length; i++) {
      const { r, g, b, a } = pixels[i];
      const index = i * 4;
      const selected = mask ? mask[i] : true;
      imageData.data[index] = r;
      imageData.data[index + 1] = g;
      imageData.data[index + 2] = b;
      imageData.data[index + 3] = selected ? a : 0;
    }
    ctx.putImageData(imageData, 0, 0);

    this.#canvas = canvas;
    this.#eraseCanvas = mask
      ? FloatingSelectionOverlay.#buildMaskedEraseCanvas(sourceRect, mask, eraseColor)
      : FloatingSelectionOverlay.#buildUniformEraseCanvas(eraseColor);
    this.#eraseIsUniform = !mask;
    this.#sourceRect = sourceRect;
    this.#liveRect = sourceRect;
    this.#blankSource = blankSource;
    this.emit({ type: "changed" });
  }

  static #buildUniformEraseCanvas(
    eraseColor: RGBA
  ): HTMLCanvasElement {
    const eraseCanvas = document.createElement("canvas");
    eraseCanvas.width = 1;
    eraseCanvas.height = 1;
    const eraseCtx = eraseCanvas.getContext("2d")!;
    eraseCtx.imageSmoothingEnabled = false;
    const eraseImageData = eraseCtx.createImageData(1, 1);
    eraseImageData.data[0] = eraseColor.r;
    eraseImageData.data[1] = eraseColor.g;
    eraseImageData.data[2] = eraseColor.b;
    eraseImageData.data[3] = eraseColor.a;
    eraseCtx.putImageData(eraseImageData, 0, 0);

    return eraseCanvas;
  }

  static #buildMaskedEraseCanvas(
    sourceRect: SelectionRect,
    mask: boolean[],
    eraseColor: RGBA
  ): HTMLCanvasElement {
    const eraseCanvas = document.createElement("canvas");
    eraseCanvas.width = sourceRect.width;
    eraseCanvas.height = sourceRect.height;
    const eraseCtx = eraseCanvas.getContext("2d")!;
    eraseCtx.imageSmoothingEnabled = false;
    const eraseImageData = eraseCtx.createImageData(
      sourceRect.width,
      sourceRect.height
    );

    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) {
        continue;
      }
      const index = i * 4;
      eraseImageData.data[index] = eraseColor.r;
      eraseImageData.data[index + 1] = eraseColor.g;
      eraseImageData.data[index + 2] = eraseColor.b;
      eraseImageData.data[index + 3] = eraseColor.a;
    }
    eraseCtx.putImageData(eraseImageData, 0, 0);

    return eraseCanvas;
  }

  /**
   * Updates the floating selection position.
   */
  updatePosition(
    liveRect: SelectionRect
  ): void {
    if (!this.#canvas) {
      return;
    }

    this.#liveRect = liveRect;
    this.emit({ type: "changed" });
  }

  clear(): void {
    const wasActive = this.#canvas !== null;

    this.#canvas = null;
    this.#eraseCanvas = null;
    this.#eraseIsUniform = true;
    this.#sourceRect = null;
    this.#liveRect = null;
    this.#blankSource = true;

    if (wasActive) {
      this.emit({ type: "changed" });
    }
  }

  /**
   * Draws the floating selection.
   */
  draw(
    ctx: CanvasRenderingContext2D
  ): void {
    if (!this.#canvas || !this.#sourceRect || !this.#liveRect) {
      return;
    }

    if (this.#blankSource && this.#eraseCanvas) {
      const source = this.#sourceRect;
      if (this.#eraseIsUniform) {
        ctx.drawImage(this.#eraseCanvas, 0, 0, 1, 1, source.x, source.y, source.width, source.height);
      }
      else {
        ctx.drawImage(this.#eraseCanvas, source.x, source.y);
      }
    }

    const live = this.#liveRect;
    ctx.drawImage(this.#canvas, live.x, live.y, live.width, live.height);
  }
}
