// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { filledArray } from "../../utils/array.ts";
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
  pixels: readonly RGBA8[];
  /**
   * Row-major selection mask.
   */
  mask?: readonly boolean[];
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
  sourceRect: SelectionRect;
  liveRect: SelectionRect;
  blankSource: boolean;
}

export class FloatingSelection extends Emitter<
  FloatingSelectionEvent
> {
  #state: FloatingState | null = null;

  get isActive(): boolean {
    return this.#state !== null;
  }

  create(
    options: FloatingSelectionOptions
  ): void {
    const {
      sourceRect,
      pixels,
      eraseColor,
      blankSource = true
    } = options;
    const mask = options.mask ?? filledArray(pixels.length, true);

    this.#state = {
      canvas: buildMaskedContentCanvas(sourceRect, pixels, mask),
      eraseCanvas: buildMaskedFillCanvas(sourceRect, mask, eraseColor),
      maskCanvas: buildMaskedFillCanvas(sourceRect, mask, kOpaqueMask),
      sourceRect,
      liveRect: sourceRect,
      blankSource
    };
    this.emit("changed");
  }

  updatePosition(
    liveRect: SelectionRect,
    blankSource?: boolean
  ): void {
    if (this.#state === null) {
      return;
    }

    this.#state.liveRect = liveRect;
    this.#state.blankSource = blankSource ?? this.#state.blankSource;
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
      FloatingSelection.#clearMasked(ctx, state, state.sourceRect);
      ctx.drawImage(state.eraseCanvas, state.sourceRect.x, state.sourceRect.y);
    }

    const live = state.liveRect;
    FloatingSelection.#clearMasked(ctx, state, live);
    ctx.drawImage(state.canvas, live.x, live.y, live.width, live.height);
  }

  static #clearMasked(
    ctx: CanvasRenderingContext2D,
    state: FloatingState,
    rect: SelectionRect
  ): void {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.drawImage(state.maskCanvas, rect.x, rect.y);
    ctx.restore();
  }
}
