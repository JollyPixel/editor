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

export interface SelectEditEntry {
  positions: Vec2[];
  beforeColors: RGBA[];
  afterColors: RGBA[];
  oldRect: SelectionRect;
  newRect: SelectionRect;
}

export interface SelectControllerOptions {
  canvasBuffer: CanvasBuffer;
  renderer: CanvasRenderer;
  selectionOverlay: SelectionOverlay;
  eraseColor: RGBA;
  /**
   * Called after a selection edit (delete/move/paste/rotate/flip) is
   * committed to the buffer, reporting exactly what changed so the caller
   * can record it for undo/redo.
   */
  onCommit: (entry: SelectEditEntry) => void;
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
  #onCommit: (entry: SelectEditEntry) => void;

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
        this.#commitFootprintChange({
          oldRect: result.source,
          newRect: result.dest,
          newContent: snapshot,
          skipErase: result.skipErase
        });
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

    this.#commitFootprintChange({
      oldRect: result.rect,
      newRect: result.rect,
      newContent: result.pixels,
      skipErase: true
    });
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

    const eraseColors: RGBA[] = new Array(rect.width * rect.height).fill(this.#eraseColor);
    this.#commitFootprintChange({ oldRect: rect, newRect: rect, newContent: eraseColors, skipErase: true });
    this.#select.markErased(this.#eraseColor);

    return true;
  }

  /**
   * "R": rotates the active selection 90 degrees clockwise around its
   * center. No-op (returns false) unless a selection is currently active.
   */
  handleRotate(): boolean {
    if (this.#select.state !== "selected") {
      return false;
    }

    const result = this.#select.rotate();
    const snapshot = this.#select.snapshot;
    if (!result || !snapshot) {
      return false;
    }

    this.#commitFootprintChange({
      oldRect: result.oldRect,
      newRect: result.newRect,
      newContent: snapshot,
      skipErase: false
    });
    this.#selectionOverlay.setRect(result.newRect);

    return true;
  }

  /** "H": mirrors the active selection's content left-right in place. */
  handleFlipHorizontal(): boolean {
    return this.#handleFlip((select) => select.flipHorizontal());
  }

  /** "V": mirrors the active selection's content top-bottom in place. */
  handleFlipVertical(): boolean {
    return this.#handleFlip((select) => select.flipVertical());
  }

  /**
   * Shared guard/commit tail for handleFlipHorizontal/handleFlipVertical —
   * flipping never moves or resizes the rect, only its content.
   */
  #handleFlip(
    flip: (select: Select) => SelectionRect | null
  ): boolean {
    if (this.#select.state !== "selected") {
      return false;
    }

    const rect = flip(this.#select);
    const snapshot = this.#select.snapshot;
    if (!rect || !snapshot) {
      return false;
    }

    this.#commitFootprintChange({ oldRect: rect, newRect: rect, newContent: snapshot, skipErase: false });

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
   * Shared commit step for move/delete/paste/rotate/flip: vacates
   * `oldRect` (unless `skipErase`), paints `newContent` into `newRect`, and
   * reports the union of both footprints' before/after colors so the
   * caller can record a single undo/redo entry. Out-of-bounds positions are
   * silently clipped by CanvasBuffer, same as every other paint path here.
   */
  #commitFootprintChange(
    change: {
      oldRect: SelectionRect;
      newRect: SelectionRect;
      newContent: RGBA[];
      skipErase: boolean;
    }
  ): void {
    const { oldRect, newRect, newContent, skipErase } = change;
    const positions = unionPositions(oldRect, newRect);
    const beforeColors = this.#sampleColors(positions);

    if (!skipErase) {
      this.#canvasBuffer.drawPixels(rectPositions(oldRect), this.#eraseColor);
    }
    this.#canvasBuffer.drawRegion(newRect, newContent);
    this.#canvasBuffer.copyToMaster();

    const afterColors = this.#sampleColors(positions);
    this.#renderer.drawFrame();
    this.#onCommit({
      positions,
      beforeColors,
      afterColors,
      oldRect,
      newRect
    });
  }

  /**
   * Resyncs the selection box and cached content after a history undo/redo
   * replay: `rect` is the footprint the selection should now cover
   * (oldRect on undo, newRect on redo), and the content is re-sampled from
   * the buffer — now the source of truth — rather than trusting whatever
   * Select had cached before the replay.
   */
  syncSelectionAfterHistory(
    rect: SelectionRect
  ): void {
    const snapshot = Select.captureSnapshot(this.#canvasBuffer, rect);
    this.#select.restoreRect(rect, snapshot);
    this.#selectionOverlay.setRect(rect);
  }

  /**
   * Samples `positions` from the buffer, treating out-of-bounds positions
   * as fully transparent — mirrors Select.captureSnapshot, since
   * CanvasBuffer.samplePixel doesn't itself bounds-check a negative x/y.
   */
  #sampleColors(
    positions: Vec2[]
  ): RGBA[] {
    const size = this.#canvasBuffer.getSize();

    return positions.map((pos) => {
      if (
        pos.x < 0 || pos.x >= size.x ||
        pos.y < 0 || pos.y >= size.y
      ) {
        return { r: 0, g: 0, b: 0, a: 0 };
      }

      const [r, g, b, a] = this.#canvasBuffer.samplePixel(pos.x, pos.y);

      return { r, g, b, a };
    });
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

/**
 * The deduplicated union of two rects' positions — a Move's source/dest can
 * overlap, and a Rotate's old/new footprint can differ in shape entirely
 * (non-square rect), so this can't be expressed as a single bounding rect
 * without over-capturing untouched cells.
 */
function unionPositions(
  a: SelectionRect,
  b: SelectionRect
): Vec2[] {
  const seen = new Set<string>();
  const result: Vec2[] = [];

  for (const pos of [...rectPositions(a), ...rectPositions(b)]) {
    const key = `${pos.x},${pos.y}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(pos);
    }
  }

  return result;
}
