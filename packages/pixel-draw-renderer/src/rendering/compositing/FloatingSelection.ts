// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { filledArray } from "../../utils/array.ts";
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

interface FloatingState {
  canvas: HTMLCanvasElement;
  eraseCanvas: HTMLCanvasElement;
  maskCanvas: HTMLCanvasElement;
  eraseIsUniform: boolean;
  sourceRect: SelectionRect;
  liveRect: SelectionRect;
  blankSource: boolean;
}

export class FloatingSelection extends Emitter<
  FloatingSelectionEvent
> {
  #state: FloatingState | null = null;

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
    const effectiveMask = mask ?? filledArray(
      pixels.length,
      true
    );

    this.#state = {
      canvas: buildMaskedContentCanvas(
        sourceRect,
        pixels,
        effectiveMask
      ),
      eraseCanvas: mask
        ? buildMaskedFillCanvas(sourceRect, mask, eraseColor)
        : FloatingSelection.#buildUniformEraseCanvas(
          eraseColor
        ),
      maskCanvas: mask
        ? buildMaskedFillCanvas(sourceRect, mask, kOpaqueMask)
        : FloatingSelection.#buildUniformEraseCanvas(
          kOpaqueMask
        ),
      eraseIsUniform: !mask,
      sourceRect,
      liveRect: sourceRect,
      blankSource
    };
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
    if (this.#state === null) {
      return;
    }

    this.#state.liveRect = liveRect;
    this.emit("changed");
  }

  clear(): void {
    const wasActive = this.#state !== null;

    this.#state = null;

    if (wasActive) {
      this.emit("changed");
    }
  }

  draw(
    ctx: CanvasRenderingContext2D
  ): void {
    const state = this.#state;
    if (state === null) {
      return;
    }

    if (state.blankSource) {
      FloatingSelection.#clearMaskedRect(
        ctx,
        state,
        state.sourceRect
      );
      FloatingSelection.#drawAt(
        ctx,
        state,
        state.eraseCanvas,
        state.sourceRect
      );
    }

    const live = state.liveRect;
    FloatingSelection.#clearMaskedRect(
      ctx,
      state,
      live
    );
    ctx.drawImage(
      state.canvas,
      live.x,
      live.y,
      live.width,
      live.height
    );
  }

  get isActive(): boolean {
    return this.#state !== null;
  }

  static #clearMaskedRect(
    ctx: CanvasRenderingContext2D,
    state: FloatingState,
    rect: SelectionRect
  ): void {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    FloatingSelection.#drawAt(
      ctx,
      state,
      state.maskCanvas,
      rect
    );
    ctx.restore();
  }

  static #drawAt(
    ctx: CanvasRenderingContext2D,
    state: FloatingState,
    canvas: HTMLCanvasElement,
    rect: SelectionRect
  ): void {
    if (state.eraseIsUniform) {
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
