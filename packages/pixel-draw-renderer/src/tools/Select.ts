// Import Internal Dependencies
import type {
  RGBA,
  SelectionRect,
  Vec2
} from "../types.ts";
import type { DefaultPixelBuffer } from "../buffer/types.ts";

export type SelectState = "idle" | "creating" | "selected" | "moving";

export interface ClipboardSnapshot {
  rect: SelectionRect;
  pixels: RGBA[];
}

export interface MoveResult {
  source: SelectionRect;
  dest: SelectionRect;
  skipErase: boolean;
}

export interface PasteResult {
  rect: SelectionRect;
  pixels: RGBA[];
}

/**
 * Rectangle-selection state machine
 * (idle -> creating -> selected -> moving -> selected) + clipboard.
 */
export class Select {
  #state: SelectState = "idle";
  #createStart: Vec2 | null = null;
  #rect: SelectionRect | null = null;
  #snapshot: RGBA[] | null = null;
  #moveOrigin: Vec2 | null = null;
  #moveBaseRect: SelectionRect | null = null;
  #liveRect: SelectionRect | null = null;
  #clipboard: ClipboardSnapshot | null = null;
  /**
   * True right after paste(): the selection still sits on the original it
   * was copied from, so the next finishMove() must not erase it. Reset to
   * false once that move happens — later moves of the same piece erase normally.
   */
  #skipNextErase = false;

  get state(): SelectState {
    return this.#state;
  }

  /**
   * The rect to render: the live drag preview while creating/moving, the
   * static rect otherwise. Null when idle.
   */
  get rect(): SelectionRect | null {
    return this.#state === "moving" ? this.#liveRect : this.#rect;
  }

  /**
   * Pixel data inside the selection (row-major). Stays valid across a
   * move — position changes, content doesn't.
   */
  get snapshot(): RGBA[] | null {
    return this.#snapshot;
  }

  get hasClipboard(): boolean {
    return this.#clipboard !== null;
  }

  /**
   * Whether the next finishMove() will skip erasing its source (see
   * #skipNextErase) — lets a caller decide whether to preview the source as
   * vacated while dragging.
   */
  get willSkipErase(): boolean {
    return this.#skipNextErase;
  }

  /**
   * Begins dragging a new selection from `pos`, discarding prior state.
   * Callers should already have ruled out a move via hitTest.
   */
  startCreate(
    position: Vec2
  ): SelectionRect {
    this.#state = "creating";
    this.#createStart = position;
    this.#rect = Select.normalizeRect(position, position);
    this.#skipNextErase = false;

    return this.#rect;
  }

  updateCreate(
    position: Vec2
  ): SelectionRect | null {
    if (
      this.#state !== "creating" ||
      !this.#createStart
    ) {
      return null;
    }

    this.#rect = Select.normalizeRect(
      this.#createStart,
      position
    );

    return this.#rect;
  }

  /**
   * Finalizes creation with a snapshot the caller captured (via
   * captureSnapshot). No-op unless "creating".
   */
  finishCreate(
    snapshot: RGBA[]
  ): void {
    if (this.#state !== "creating") {
      return;
    }

    this.#snapshot = snapshot;
    this.#state = "selected";
    this.#createStart = null;
  }

  /**
   * Whether `pos` falls inside the current selection rect (only meaningful
   * while "selected") — used to decide if a mousedown starts a move or a
   * new selection.
   */
  hitTest(
    pos: Vec2
  ): boolean {
    if (
      this.#state !== "selected" ||
      !this.#rect
    ) {
      return false;
    }

    const r = this.#rect;

    return pos.x >= r.x &&
      pos.x < r.x + r.width &&
      pos.y >= r.y &&
      pos.y < r.y + r.height;
  }

  startMove(
    position: Vec2
  ): void {
    if (
      this.#state !== "selected" ||
      !this.#rect
    ) {
      return;
    }

    this.#state = "moving";
    this.#moveOrigin = position;
    this.#moveBaseRect = this.#rect;
    this.#liveRect = this.#rect;
  }

  updateMove(
    position: Vec2
  ): SelectionRect | null {
    if (
      this.#state !== "moving" ||
      !this.#moveOrigin ||
      !this.#moveBaseRect
    ) {
      return null;
    }

    const dx = position.x - this.#moveOrigin.x;
    const dy = position.y - this.#moveOrigin.y;
    this.#liveRect = {
      ...this.#moveBaseRect,
      x: this.#moveBaseRect.x + dx,
      y: this.#moveBaseRect.y + dy
    };

    return this.#liveRect;
  }

  /**
   * Ends the move (selection becomes "selected" again). Returns source/dest
   * rects, or null if not moving or nothing was displaced. `skipErase` true
   * means the caller must paint dest but not erase source (see #skipNextErase).
   */
  finishMove(): MoveResult | null {
    if (
      this.#state !== "moving" ||
      !this.#moveBaseRect ||
      !this.#liveRect
    ) {
      return null;
    }

    const source = this.#moveBaseRect;
    const dest = this.#liveRect;
    this.#rect = dest;
    this.#state = "selected";
    this.#moveOrigin = null;
    this.#moveBaseRect = null;
    this.#liveRect = null;

    if (source.x === dest.x && source.y === dest.y) {
      return null;
    }

    const skipErase = this.#skipNextErase;
    this.#skipNextErase = false;

    return {
      source,
      dest,
      skipErase
    };
  }

  /** Discards the current selection entirely. Does not clear the clipboard. */
  clear(): void {
    this.#state = "idle";
    this.#rect = null;
    this.#snapshot = null;
    this.#createStart = null;
    this.#moveOrigin = null;
    this.#moveBaseRect = null;
    this.#liveRect = null;
    this.#skipNextErase = false;
  }

  /**
   * Marks the selection's contents as erased (uniform eraseColor) in this
   * tool's own bookkeeping — caller still has to write eraseColor to the
   * actual pixel buffer.
   */
  markErased(
    eraseColor: RGBA
  ): void {
    if (!this.#rect) {
      return;
    }

    this.#snapshot = new Array(
      this.#rect.width * this.#rect.height
    ).fill(eraseColor);
  }

  /** Snapshots the current selection into the clipboard. No-op with nothing selected. */
  copy(): void {
    if (!this.#rect || !this.#snapshot) {
      return;
    }

    this.#clipboard = {
      rect: {
        ...this.#rect
      },
      pixels: [
        ...this.#snapshot
      ]
    };
  }

  /**
   * Activates the clipboard as the new selection at its original position.
   * Returns the rect/pixels to paint, or null if the clipboard is empty.
   */
  paste(): PasteResult | null {
    if (!this.#clipboard) {
      return null;
    }

    this.#rect = {
      ...this.#clipboard.rect
    };
    this.#snapshot = [
      ...this.#clipboard.pixels
    ];
    this.#state = "selected";
    this.#skipNextErase = true;

    return {
      rect: this.#rect,
      pixels: this.#snapshot
    };
  }

  /**
   * Normalizes two drag corners into a positive-size rect, inclusive of both
   * corner pixels (so a==b yields a 1x1 rect).
   */
  static normalizeRect(
    a: Vec2,
    b: Vec2
  ): SelectionRect {
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x) + 1,
      height: Math.abs(b.y - a.y) + 1
    };
  }

  /**
   * Reads a rect's pixels from `buffer` in row-major order. Out-of-bounds
   * positions sample as fully transparent, mirroring clipped writes
   * elsewhere in this package.
   */
  static captureSnapshot(
    buffer: DefaultPixelBuffer,
    rect: SelectionRect
  ): RGBA[] {
    const size = buffer.getSize();
    const pixels: RGBA[] = [];

    for (let ry = 0; ry < rect.height; ry++) {
      for (let rx = 0; rx < rect.width; rx++) {
        const x = rect.x + rx;
        const y = rect.y + ry;

        if (
          x < 0 || x >= size.x ||
          y < 0 || y >= size.y
        ) {
          pixels.push({ r: 0, g: 0, b: 0, a: 0 });
          continue;
        }

        const [r, g, b, a] = buffer.samplePixel(x, y);
        pixels.push({ r, g, b, a });
      }
    }

    return pixels;
  }
}
