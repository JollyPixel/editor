// Import Internal Dependencies
import type { RGBA, SelectionRect } from "../../types.ts";

export interface FloatingOverlayOptions {
  /** The selection's original position, rendered as eraseColor while floating. */
  sourceRect: SelectionRect;
  /** Row-major pixel data (sourceRect.width * sourceRect.height long). */
  pixels: RGBA[];
  /**
   * Rect-relative, row-major selection mask (same length as `pixels`).
   * Omitted (or every cell true) means the whole rect is selected — the
   * common rectangle-drag case, which skips the per-pixel erase canvas
   * below in favor of a cheap 1x1-stretched fill. When some cells are
   * false (a shape selection), both the content and erase canvases only
   * show/blank the masked cells, leaving the rest of the bounding box's
   * pixels visible/untouched.
   */
  mask?: boolean[];
  eraseColor: RGBA;
  /**
   * Whether to preview sourceRect as vacated (filled with eraseColor) while
   * dragging. Set false for a just-pasted selection's first move, whose
   * source still holds real content that dropping will NOT erase — blanking
   * it during the drag would misleadingly hide that content.
   * @default true
   */
  blankSource?: boolean;
}

/**
 * Renders a selection's captured pixels as a display-only overlay on top of
 * the base texture while it's being dragged (move/paste), blanking its
 * original position with `eraseColor` so it doesn't look duplicated. Owns no
 * canvas of its own to paint onto — CanvasRenderer calls draw(ctx) at the
 * point in its frame where the overlay should composite. The real
 * CanvasBuffer is never touched here — PixelArtCanvas commits the actual
 * move/paste separately, once, on drop.
 */
export class FloatingSelectionOverlay {
  #canvas: HTMLCanvasElement | null = null;
  #eraseCanvas: HTMLCanvasElement | null = null;
  /** Whether #eraseCanvas is a 1x1 swatch meant to be stretched (rect case) vs a full-size per-pixel mask (shape case). */
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
  }

  /** A 1x1 canvas holding eraseColor, stretched over the whole rect at draw time. */
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

  /**
   * A full sourceRect-sized canvas: opaque eraseColor over masked cells,
   * fully transparent (untouched when blitted) elsewhere — so blanking a
   * shape selection's source only visually erases its actual cells.
   */
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
    const eraseImageData = eraseCtx.createImageData(sourceRect.width, sourceRect.height);

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
   * Updates the overlay's live (drag) position without rebuilding its pixel
   * content. No-op when no overlay is active.
   */
  updatePosition(
    liveRect: SelectionRect
  ): void {
    if (!this.#canvas) {
      return;
    }

    this.#liveRect = liveRect;
  }

  clear(): void {
    this.#canvas = null;
    this.#eraseCanvas = null;
    this.#eraseIsUniform = true;
    this.#sourceRect = null;
    this.#liveRect = null;
    this.#blankSource = true;
  }

  /**
   * Composites the overlay onto `ctx` at its current live position. No-op
   * when no overlay is active. Called by CanvasRenderer.drawFrame() after
   * the base texture has been blitted, under the same zoom/camera transform.
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
        // Blitted (drawImage), not fillRect: fillRect anti-aliases its own
        // edges under a scaled transform while drawImage (with smoothing
        // off) doesn't, and mixing the two left a thin seam at the boundary
        // whenever zoom/camera didn't land on whole device pixels.
        ctx.drawImage(this.#eraseCanvas, 0, 0, 1, 1, source.x, source.y, source.width, source.height);
      }
      else {
        // Already sourceRect-sized 1:1 (masked cells opaque, rest
        // transparent) — a direct blit, no stretch needed.
        ctx.drawImage(this.#eraseCanvas, source.x, source.y);
      }
    }

    const live = this.#liveRect;
    ctx.drawImage(this.#canvas, live.x, live.y, live.width, live.height);
  }
}
