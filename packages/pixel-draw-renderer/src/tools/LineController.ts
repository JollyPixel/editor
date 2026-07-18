// Import Internal Dependencies
import {
  Line,
  type LineCommitTrigger
} from "./Line.ts";
import type { Brush } from "./Brush.ts";
import type { LinePreviewOverlay } from "../rendering/overlays/LinePreviewOverlay.ts";
import type { Vec2 } from "../types.ts";

export interface LineControllerOptions {
  brush: Brush;
  linePreview: LinePreviewOverlay;
  /** Commits the stamped pixels of a completed segment as a single atomic edit. */
  onCommit: (pixels: Vec2[]) => void;
}

/**
 * Glues the Line state machine to the brush (pixel stamping), the SVG line
 * preview overlay, and the host's commit path. Also owns the Shift-held flag
 * and last known cursor position, both meaningless outside line-arming.
 */
export class LineController {
  #line = new Line();
  #brush: Brush;
  #linePreview: LinePreviewOverlay;
  #onCommit: (pixels: Vec2[]) => void;

  #lastCursorPos: Vec2 | null = null;
  #isShiftHeld = false;

  constructor(
    options: LineControllerOptions
  ) {
    this.#brush = options.brush;
    this.#linePreview = options.linePreview;
    this.#onCommit = options.onCommit;
  }

  get isArmed(): boolean {
    return this.#line.isArmed;
  }

  get commitTrigger(): LineCommitTrigger {
    return this.#line.commitTrigger;
  }

  set shiftHeld(
    held: boolean
  ) {
    this.#isShiftHeld = held;
  }

  /**
   * Tracks the latest cursor position for arm() to start from, and keeps an
   * already-armed preview following the cursor.
   */
  updateCursor(
    pos: Vec2 | null
  ): void {
    this.#lastCursorPos = pos;
    if (this.#line.isArmed && pos) {
      this.#line.update(pos);
      this.refreshPreview();
    }
  }

  arm(
    commitTrigger: LineCommitTrigger
  ): void {
    if (!this.#lastCursorPos) {
      return;
    }

    this.#line.arm(this.#lastCursorPos, commitTrigger);
    this.refreshPreview();
  }

  /**
   * Commits the armed segment. If Shift is still held afterwards, immediately
   * re-arms from the just-committed endpoint (commitTrigger "mousedown") so
   * the next click continues a connected polyline instead of requiring the
   * user to release and re-press Shift to resume line drawing.
   */
  commit(): void {
    const points = this.#line.commit();
    this.#linePreview.clear();
    if (!points) {
      return;
    }

    this.#onCommit(this.#stampLinePixels(points));

    if (this.#isShiftHeld) {
      this.#line.arm(points.at(-1) ?? points[0], "mousedown");
      this.refreshPreview();
    }
  }

  cancelIfArmed(): void {
    if (!this.#line.isArmed) {
      return;
    }

    this.#line.cancel();
    this.#linePreview.clear();
  }

  refreshPreview(): void {
    if (!this.#line.isArmed) {
      return;
    }

    const points = this.#line.previewPoints ?? [];
    if (points.length > 0) {
      this.#linePreview.drawLine(
        points[0],
        points.at(-1) ?? points[0]
      );
    }
  }

  /**
   * Expands raw rasterized line points into brush-stamped, deduplicated
   * texture pixels (Line has no brush awareness).
   */
  #stampLinePixels(
    points: Vec2[]
  ): Vec2[] {
    const stamped = new Map<string, Vec2>();
    for (const point of points) {
      for (const pixel of this.#brush.affectedPixels(point.x, point.y)) {
        stamped.set(`${pixel.x},${pixel.y}`, pixel);
      }
    }

    return [...stamped.values()];
  }
}
