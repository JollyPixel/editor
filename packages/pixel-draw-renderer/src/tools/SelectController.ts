// Import Internal Dependencies
import { Select } from "./Select.ts";
import type { CanvasBuffer } from "../buffer/CanvasBuffer.ts";
import type { CanvasRenderer } from "../rendering/CanvasRenderer.ts";
import type { SelectionOverlay } from "../rendering/overlays/SelectionOverlay.ts";
import type {
  RGBA,
  SelectionRect,
  Vec2
} from "../types.ts";

export interface SelectControllerOptions {
  canvasBuffer: CanvasBuffer;
  renderer: CanvasRenderer;
  selectionOverlay: SelectionOverlay;
  eraseColor: RGBA;
  /** Called after a selection edit (delete/move/paste) is committed to the buffer. */
  onCommit: () => void;
}

/**
 * Glues the Select state machine to the pixel buffer, renderer (floating
 * drag overlay + frame redraws) and the SVG selection-rect overlay.
 */
export class SelectController {
  #select = new Select();
  #canvasBuffer: CanvasBuffer;
  #renderer: CanvasRenderer;
  #selectionOverlay: SelectionOverlay;
  #eraseColor: RGBA;
  #onCommit: () => void;

  constructor(
    options: SelectControllerOptions
  ) {
    this.#canvasBuffer = options.canvasBuffer;
    this.#renderer = options.renderer;
    this.#selectionOverlay = options.selectionOverlay;
    this.#eraseColor = options.eraseColor;
    this.#onCommit = options.onCommit;
  }

  get rect(): SelectionRect | null {
    return this.#select.rect;
  }

  /**
   * Left mousedown in "select" mode: grabs the existing selection to move it
   * when `pos` falls inside it, otherwise discards any prior selection and
   * starts dragging out a new rectangle.
   */
  handleStart(
    pos: Vec2
  ): void {
    if (this.#select.state === "selected" && this.#select.hitTest(pos)) {
      this.#select.startMove(pos);

      const rect = this.#select.rect;
      const snapshot = this.#select.snapshot;
      if (rect && snapshot) {
        this.#renderer.setFloatingOverlay({
          sourceRect: rect,
          pixels: snapshot,
          eraseColor: this.#eraseColor,
          blankSource: !this.#select.willSkipErase
        });
        this.#renderer.drawFrame();
      }

      return;
    }

    this.clear();
    const rect = this.#select.startCreate(pos);
    this.#selectionOverlay.setRect(rect);
  }

  handleMove(
    pos: Vec2
  ): void {
    if (this.#select.state === "creating") {
      const rect = this.#select.updateCreate(pos);
      if (rect) {
        this.#selectionOverlay.setRect(rect);
      }

      return;
    }

    if (this.#select.state === "moving") {
      const rect = this.#select.updateMove(pos);
      if (rect) {
        this.#selectionOverlay.setRect(rect);
        this.#renderer.updateFloatingOverlayPosition(rect);
        this.#renderer.drawFrame();
      }
    }
  }

  handleEnd(): void {
    if (this.#select.state === "creating") {
      const rect = this.#select.rect;
      if (rect) {
        const snapshot = Select.captureSnapshot(this.#canvasBuffer, rect);
        this.#select.finishCreate(snapshot);
      }

      return;
    }

    if (this.#select.state === "moving") {
      const snapshot = this.#select.snapshot;
      const result = this.#select.finishMove();
      this.#renderer.clearFloatingOverlay();

      if (result && snapshot) {
        if (!result.skipErase) {
          this.#eraseRegion(result.source);
        }
        this.#paintRegion(result.dest, snapshot);
      }

      const rect = this.#select.rect;
      if (rect) {
        this.#selectionOverlay.setRect(rect);
      }
    }
  }

  /**
   * Ctrl/Cmd+C: snapshots the active selection into Select's clipboard.
   * No-op (returns false, letting the browser's default copy proceed)
   * unless a selection is currently active.
   */
  handleCopy(): boolean {
    if (this.#select.state !== "selected") {
      return false;
    }

    this.#select.copy();

    return true;
  }

  /**
   * Ctrl/Cmd+V: stamps the clipboard snapshot back onto the buffer at the
   * exact position it was copied from, and makes it the new active
   * selection so the next drag relocates the duplicate.
   */
  handlePaste(): boolean {
    const result = this.#select.paste();
    if (!result) {
      return false;
    }

    this.#paintRegion(result.rect, result.pixels);
    this.#selectionOverlay.setRect(result.rect);

    return true;
  }

  /**
   * Delete key: fills the active selection with the configured erase color.
   * The selection stays active, now over blanked pixels.
   */
  handleDelete(): boolean {
    if (this.#select.state !== "selected") {
      return false;
    }

    const rect = this.#select.rect;
    if (!rect) {
      return false;
    }

    this.#eraseRegion(rect);
    this.#select.markErased(this.#eraseColor);

    return true;
  }

  clear(): void {
    this.#select.clear();
    this.#selectionOverlay.clear();
    this.#renderer.clearFloatingOverlay();
  }

  refreshOverlay(): void {
    const rect = this.#select.rect;
    if (rect) {
      this.#selectionOverlay.setRect(rect);
    }
  }

  /**
   * Fills every position in `rect` with the configured erase color. Used to
   * vacate a Delete'd or moved-away-from selection. Out-of-bounds positions
   * are silently clipped by CanvasBuffer.drawPixels, same as every other
   * paint path in this class.
   */
  #eraseRegion(
    rect: SelectionRect
  ): void {
    this.#canvasBuffer.drawPixels(
      rectPositions(rect),
      this.#eraseColor
    );
    this.#canvasBuffer.copyToMaster();
    this.#renderer.drawFrame();
    this.#onCommit();
  }

  /**
   * Plain-overwrites `rect` with `pixels` (multi-colored, unlike
   * #eraseRegion's uniform fill) — the commit step for a Move's destination
   * or a Duplicate paste.
   */
  #paintRegion(
    rect: SelectionRect,
    pixels: RGBA[]
  ): void {
    this.#canvasBuffer.drawRegion(rect, pixels);
    this.#canvasBuffer.copyToMaster();
    this.#renderer.drawFrame();
    this.#onCommit();
  }
}

/**
 * Enumerates every texture-space position covered by `rect`, row-major.
 */
function* rectPositions(
  rect: SelectionRect
): IterableIterator<Vec2> {
  for (let y = 0; y < rect.height; y++) {
    for (let x = 0; x < rect.width; x++) {
      yield { x: rect.x + x, y: rect.y + y };
    }
  }
}
