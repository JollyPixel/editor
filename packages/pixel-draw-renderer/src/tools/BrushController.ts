// Import Internal Dependencies
import type { Brush } from "./Brush.ts";
import type { CanvasBuffer } from "../buffer/CanvasBuffer.ts";
import type { CanvasRenderer } from "../rendering/CanvasRenderer.ts";
import { toRGBA } from "../utils/colors.ts";
import type { RGBA, Vec2 } from "../types.ts";

export interface BrushControllerOptions {
  brush: Brush;
  canvasBuffer: CanvasBuffer;
  renderer: CanvasRenderer;
  /**
   * Called once per completed stroke (on endStroke) with the deduplicated
   * set of pixels touched and the color they were stamped with. Mirrors the
   * "stroke" hook shape emitted elsewhere in CanvasManager. Not called for a
   * stroke that never touched any in-bounds pixel.
   */
  onCommit: (pixels: Vec2[], color: RGBA) => void;
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
  #onCommit: (pixels: Vec2[], color: RGBA) => void;

  #strokeDirty = new Map<string, Vec2>();
  #strokeColor: RGBA | null = null;
  #isActive = false;

  constructor(
    options: BrushControllerOptions
  ) {
    this.#brush = options.brush;
    this.#canvasBuffer = options.canvasBuffer;
    this.#renderer = options.renderer;
    this.#onCommit = options.onCommit;
  }

  /** Whether a stroke is currently being dragged (mousedown held). */
  get isActive(): boolean {
    return this.#isActive;
  }

  startStroke(
    tx: number,
    ty: number
  ): void {
    this.#isActive = true;
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
    this.#isActive = false;
  }

  #stamp(
    tx: number,
    ty: number
  ): void {
    const rgba = toRGBA(this.#brush.getColor());

    // getAffectedPixels is a fresh, single-use generator each call, so it is
    // called once per consumer rather than materialized into an array here.
    this.#canvasBuffer.drawPixels(
      this.#brush.getAffectedPixels(tx, ty), rgba
    );
    this.#renderer.drawFrame();

    this.#strokeColor ??= rgba;
    for (const pixel of this.#brush.getAffectedPixels(tx, ty)) {
      this.#strokeDirty.set(`${pixel.x},${pixel.y}`, pixel);
    }
  }

  #commit(): void {
    if (
      this.#strokeDirty.size === 0 ||
      this.#strokeColor === null
    ) {
      this.#strokeDirty.clear();
      this.#strokeColor = null;

      return;
    }

    const positions = [...this.#strokeDirty.values()];
    const color = this.#strokeColor;
    this.#strokeDirty.clear();
    this.#strokeColor = null;

    this.#onCommit(positions, color);
  }
}
