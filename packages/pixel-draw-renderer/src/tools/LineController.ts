// Import Internal Dependencies
import {
  Line,
  type LineCommitTrigger
} from "./Line.ts";
import type {
  Brush,
  BrushColorSlot
} from "./Brush.ts";
import type { EditPipeline } from "../sync/EditPipeline.ts";
import type { LinePreview } from "../rendering/overlays/LinePreview.ts";
import { toRGBA } from "../utils/colors.ts";
import type {
  PeerStrokePixel,
  Vec2
} from "../types.ts";

export interface LineControllerOptions {
  brush: Brush;
  linePreview: LinePreview;
  pipeline: EditPipeline;
  /**
   * Receives live line pixels for peer streaming.
   */
  onProgress?: (pixels: PeerStrokePixel[]) => void;
}

export class LineController {
  #line = new Line();
  #brush: Brush;
  #linePreview: LinePreview;
  #pipeline: EditPipeline;
  #onProgress?: (pixels: PeerStrokePixel[]) => void;

  #lastCursorPos: Vec2 | null = null;
  #isShiftHeld = false;
  #colorSlot: BrushColorSlot = "primary";

  constructor(
    options: LineControllerOptions
  ) {
    this.#brush = options.brush;
    this.#linePreview = options.linePreview;
    this.#pipeline = options.pipeline;
    this.#onProgress = options.onProgress;
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
    commitTrigger: LineCommitTrigger,
    colorSlot: BrushColorSlot = "primary"
  ): void {
    if (!this.#lastCursorPos) {
      return;
    }

    this.#line.arm(
      this.#lastCursorPos,
      commitTrigger
    );
    this.#colorSlot = colorSlot;
    this.refreshPreview();
  }

  commit(
    colorSlot: BrushColorSlot = this.#colorSlot
  ): void {
    const points = this.#line.commit();
    this.#linePreview.clear();
    if (!points) {
      return;
    }

    this.#pipeline.commitPixels(
      this.#stampLinePixels(points),
      colorSlot
    );
    // Drop the queued pre-commit ghost tick to prevent stale peer state.
    this.#onProgress?.([]);

    if (this.#isShiftHeld) {
      this.#line.arm(
        points.at(-1) ?? points[0],
        "mousedown"
      );
      this.#colorSlot = colorSlot;
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

      const color = toRGBA(
        this.#brush[this.#colorSlot].asString()
      );
      this.#onProgress?.(
        this.#stampLinePixels(points).map((pos) => {
          return { ...pos, color };
        })
      );
    }
  }

  /**
    * Expands line points into unique brush pixels.
   */
  #stampLinePixels(
    points: Vec2[]
  ): Vec2[] {
    const stamped = new Map<string, Vec2>();
    for (const point of points) {
      const affectedPixels = this.#brush.affectedPixels(
        point.x,
        point.y
      );

      for (const pixel of affectedPixels) {
        stamped.set(`${pixel.x},${pixel.y}`, pixel);
      }
    }

    return [...stamped.values()];
  }
}
