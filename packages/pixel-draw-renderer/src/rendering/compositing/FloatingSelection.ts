// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { createCanvas2D } from "../Canvas2D.ts";
import {
  buildMaskedContentCanvas,
  buildMaskedFillCanvas
} from "./selectionCanvas.ts";
import type {
  RGBA8,
  SelectionRect
} from "../../types.ts";

// CONSTANTS
const kOpaqueMask: RGBA8 = {
  r: 0,
  g: 0,
  b: 0,
  a: 255
};

export interface FloatingSelectionOptions {
  sourceRect: SelectionRect;
  /**
   * Row-major selection pixels.
   */
  pixels: RGBA8[];
  /**
   * Row-major selection mask.
   */
  mask?: boolean[];
  eraseColor: RGBA8;
  /**
   * Whether to erase the source while dragging.
   * @default true
   */
  blankSource?: boolean;
}

/**
 * Fired for floating-selection view changes not represented by the buffer.
 */
export type FloatingSelectionEvent = {
  changed: () => void;
};

export class FloatingSelection extends Emitter<
  FloatingSelectionEvent
> {
  #canvas: HTMLCanvasElement | null = null;
  #eraseCanvas: HTMLCanvasElement | null = null;
  #maskCanvas: HTMLCanvasElement | null = null;
  #eraseIsUniform = true;
  #sourceRect: SelectionRect | null = null;
  #liveRect: SelectionRect | null = null;
  #blankSource: boolean = true;

  create(
    options: FloatingSelectionOptions
  ): void {
    const {
      sourceRect,
      pixels,
      mask,
      eraseColor,
      blankSource = true
    } = options;
    const effectiveMask = mask ?? new Array(
      pixels.length
    ).fill(true);

    this.#canvas = buildMaskedContentCanvas(
      sourceRect,
      pixels,
      effectiveMask
    );
    this.#eraseCanvas = mask
      ? buildMaskedFillCanvas(sourceRect, mask, eraseColor)
      : FloatingSelection.#buildUniformEraseCanvas(
        eraseColor
      );
    this.#maskCanvas = mask
      ? buildMaskedFillCanvas(sourceRect, mask, kOpaqueMask)
      : FloatingSelection.#buildUniformEraseCanvas(
        kOpaqueMask
      );
    this.#eraseIsUniform = !mask;
    this.#sourceRect = sourceRect;
    this.#liveRect = sourceRect;
    this.#blankSource = blankSource;
    this.emit("changed");
  }

  static #buildUniformEraseCanvas(
    eraseColor: RGBA8
  ): HTMLCanvasElement {
    const {
      canvas: eraseCanvas,
      context: eraseCtx
    } = createCanvas2D(1, 1);
    eraseCtx.imageSmoothingEnabled = false;

    const eraseImageData = eraseCtx.createImageData(1, 1);
    eraseImageData.data[0] = eraseColor.r;
    eraseImageData.data[1] = eraseColor.g;
    eraseImageData.data[2] = eraseColor.b;
    eraseImageData.data[3] = eraseColor.a;
    eraseCtx.putImageData(eraseImageData, 0, 0);

    return eraseCanvas;
  }

  updatePosition(
    liveRect: SelectionRect
  ): void {
    if (!this.#canvas) {
      return;
    }

    this.#liveRect = liveRect;
    this.emit("changed");
  }

  clear(): void {
    const wasActive = this.#canvas !== null;

    this.#canvas = null;
    this.#eraseCanvas = null;
    this.#maskCanvas = null;
    this.#eraseIsUniform = true;
    this.#sourceRect = null;
    this.#liveRect = null;
    this.#blankSource = true;

    if (wasActive) {
      this.emit("changed");
    }
  }

  draw(
    ctx: CanvasRenderingContext2D
  ): void {
    if (
      !this.#canvas ||
      !this.#sourceRect ||
      !this.#liveRect
    ) {
      return;
    }

    if (
      this.#blankSource &&
      this.#eraseCanvas &&
      this.#maskCanvas
    ) {
      const source = this.#sourceRect;
      this.#clearMaskedRect(ctx, source);
      this.#drawAt(
        ctx,
        this.#eraseCanvas,
        source
      );
    }

    const live = this.#liveRect;
    if (this.#maskCanvas) {
      this.#clearMaskedRect(ctx, live);
    }
    ctx.drawImage(
      this.#canvas,
      live.x,
      live.y,
      live.width,
      live.height
    );
  }

  get isActive(): boolean {
    return this.#canvas !== null;
  }

  #clearMaskedRect(
    ctx: CanvasRenderingContext2D,
    rect: SelectionRect
  ): void {
    const maskCanvas = this.#maskCanvas;
    if (!maskCanvas) {
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    this.#drawAt(
      ctx,
      maskCanvas,
      rect
    );
    ctx.restore();
  }

  #drawAt(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    rect: SelectionRect
  ): void {
    if (this.#eraseIsUniform) {
      ctx.drawImage(
        canvas,
        0,
        0,
        1,
        1,
        rect.x,
        rect.y,
        rect.width,
        rect.height
      );
    }
    else {
      ctx.drawImage(
        canvas,
        rect.x,
        rect.y
      );
    }
  }
}
