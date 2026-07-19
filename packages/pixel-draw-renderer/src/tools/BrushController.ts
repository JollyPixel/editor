// Import Internal Dependencies
import type { Brush, BrushColorSlot } from "./Brush.ts";
import type { CanvasBuffer } from "../buffer/CanvasBuffer.ts";
import type { CanvasRenderer } from "../rendering/CanvasRenderer.ts";
import { rgbToHex, toRGBA } from "../utils/colors.ts";
import type { RGBA, Vec2 } from "../types.ts";

export interface BrushControllerOptions {
  brush: Brush;
  canvasBuffer: CanvasBuffer;
  renderer: CanvasRenderer;
  /**
   * Called once per completed stroke with the deduplicated pixels touched,
   * their stamped color, and each pixel's color immediately before this
   * stroke touched it (parallel to `pixels`, for undo history). Not called
   * for a stroke that never touched any in-bounds pixel.
   */
  onCommit: (pixels: Vec2[], color: RGBA, beforeColors: RGBA[]) => void;
}

/**
 * Glues the Brush model (pixel-stamping geometry) to the pixel buffer and
 * renderer, mirroring LineController/SelectController: owns the in-progress
 * stroke state (dirty pixels + color) and commits it as a single atomic edit
 * on endStroke.
 */
export class BrushController {
  #brush: Brush;
  #canvasBuffer: CanvasBuffer;
  #renderer: CanvasRenderer;
  #onCommit: (pixels: Vec2[], color: RGBA, beforeColors: RGBA[]) => void;

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
    this.#onCommit = options.onCommit;
  }

  /** Which color slot is being dragged, or `false` when no stroke is active. */
  get isActive(): BrushColorSlot | false {
    return this.#activeSlot ?? false;
  }

  /**
   * Whether the next primary-down in paint mode should pick a color instead
   * of starting a stroke. Cleared automatically by a successful `pick()`.
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
   * Samples the pixel at the given texture position, applies it to the
   * brush's primary color, and disarms picking. Returns the sampled color,
   * or `null` (leaving state untouched) if the position is outside the texture.
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
   * Starts a stroke stamping with the given color slot. Mutually exclusive
   * with the other slot: callers should check `isActive` before starting a
   * stroke on the other button.
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
   * Ends the current stroke: copies the working buffer to master and emits
   * the accumulated dirty pixels as a single "stroke" commit.
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
    const rgba = toRGBA(this.#brush[this.#activeSlot ?? "primary"].asString());

    // Materialized once (unlike the rest of this class, which prefers
    // re-calling the fresh generator over allocating) because the before-
    // color of each newly touched pixel must be sampled before drawPixels
    // overwrites it, then the same list is reused for the draw call.
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

    this.#onCommit(positions, color, beforeColors);
  }
}
