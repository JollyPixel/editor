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
  mask: boolean[];
}

export interface MoveResult {
  source: SelectionRect;
  dest: SelectionRect;
  skipErase: boolean;
}

export interface PasteResult {
  rect: SelectionRect;
  pixels: RGBA[];
  mask: boolean[];
}

/**
 * Rectangle- and shape-selection state machine
 * (idle -> creating -> selected -> moving -> selected) + clipboard.
 *
 * Every selection carries a rect-relative `mask` (row-major, same length as
 * `snapshot`) alongside its bounding rect: true where a cell is actually
 * part of the selection. A plain rectangle drag selects every cell (an
 * all-true mask); a magic-wand shape selection (see ShapeSelect) can leave
 * some cells outside the mask, and every operation below (hitTest, move,
 * delete, copy/paste, rotate, flip) respects it instead of assuming the
 * whole bounding box is selected.
 */
export class Select {
  #state: SelectState = "idle";
  #createStart: Vec2 | null = null;
  #rect: SelectionRect | null = null;
  #snapshot: RGBA[] | null = null;
  #mask: boolean[] | null = null;
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
   * Pixel data inside the selection's bounding box (row-major). Stays valid
   * across a move — position changes, content doesn't. Cells outside `mask`
   * hold whatever was last captured there but are never painted/erased.
   */
  get snapshot(): RGBA[] | null {
    return this.#snapshot;
  }

  /**
   * Rect-relative, row-major selection mask (same length/indexing as
   * `snapshot`): true where a cell is actually selected. Always all-true
   * for a rectangle-drag selection; only null while idle/creating.
   */
  get mask(): boolean[] | null {
    return this.#mask;
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
   * Begins dragging a new rectangle selection from `pos`, discarding prior
   * state. Callers should already have ruled out a move via hitTest.
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
   * Finalizes a rectangle-drag creation with a snapshot the caller captured
   * (via captureSnapshot). The mask is implicitly all-true — a drag always
   * selects its whole bounding box. No-op unless "creating".
   */
  finishCreate(
    snapshot: RGBA[]
  ): void {
    if (this.#state !== "creating") {
      return;
    }

    this.#snapshot = snapshot;
    this.#mask = new Array(snapshot.length).fill(true);
    this.#state = "selected";
    this.#createStart = null;
  }

  /**
   * Establishes a brand-new selection directly (no drag), e.g. a
   * magic-wand shape click: enters "selected" with the given rect/snapshot/
   * mask from any prior state, discarding whatever was there before.
   */
  selectRegion(
    rect: SelectionRect,
    snapshot: RGBA[],
    mask: boolean[]
  ): void {
    this.#enterSelected(rect, snapshot, mask);
    this.#skipNextErase = false;
  }

  /**
   * Whether `pos` falls inside the current selection's bounding rect (only
   * meaningful while "selected") — used to decide if a mousedown starts a
   * move or a new selection. Deliberately bounding-rect-only, not
   * mask-aware: a shape selection should be grabbable from anywhere in its
   * bounding box, exactly like a rectangle selection — requiring a click on
   * a masked-true cell specifically made moving an oddly-shaped selection
   * feel unreliable in practice.
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
   * The mask itself is unaffected by a move (same shape, new position).
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

  /**
   * Forcibly resyncs rect/snapshot/mask to `rect`/`snapshot`/`mask`,
   * becoming "selected" regardless of prior state. Used to re-align the
   * selection box and cached content with the buffer after a history
   * undo/redo replay, which mutates the buffer directly without going
   * through this class's own move/rotate/flip methods.
   */
  restoreRect(
    rect: SelectionRect,
    snapshot: RGBA[],
    mask: boolean[]
  ): void {
    this.#enterSelected(rect, snapshot, mask);
  }

  /** Discards the current selection entirely. Does not clear the clipboard. */
  clear(): void {
    this.#state = "idle";
    this.#rect = null;
    this.#snapshot = null;
    this.#mask = null;
    this.#createStart = null;
    this.#moveOrigin = null;
    this.#moveBaseRect = null;
    this.#liveRect = null;
    this.#skipNextErase = false;
  }

  /**
   * Marks the selection's masked cells as erased (uniform eraseColor) in
   * this tool's own bookkeeping — caller still has to write eraseColor to
   * the actual pixel buffer. Cells outside the mask are left untouched.
   */
  markErased(
    eraseColor: RGBA
  ): void {
    if (!this.#rect || !this.#mask || !this.#snapshot) {
      return;
    }

    const mask = this.#mask;
    const snapshot = this.#snapshot;
    this.#snapshot = mask.map((selected, i) => (selected ? eraseColor : snapshot[i]));
  }

  /** Snapshots the current selection into the clipboard. No-op with nothing selected. */
  copy(): void {
    if (!this.#rect || !this.#snapshot || !this.#mask) {
      return;
    }

    this.#clipboard = {
      rect: {
        ...this.#rect
      },
      pixels: [
        ...this.#snapshot
      ],
      mask: [
        ...this.#mask
      ]
    };
  }

  /**
   * Activates the clipboard as the new selection at its original position.
   * Returns the rect/pixels/mask to paint, or null if the clipboard is empty.
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
    this.#mask = [
      ...this.#clipboard.mask
    ];
    this.#state = "selected";
    this.#skipNextErase = true;

    return {
      rect: this.#rect,
      pixels: this.#snapshot,
      mask: this.#mask
    };
  }

  /**
   * Rotates the active selection 90 degrees clockwise, pivoting on its
   * center (width/height swap, center point held fixed). Rotates the mask
   * along with the pixel content. No-op (null) unless "selected". Returns
   * the pre/post rects so the caller can repaint the old footprint away and
   * the new one in.
   */
  rotate(): { oldRect: SelectionRect; newRect: SelectionRect; } | null {
    if (
      this.#state !== "selected" ||
      !this.#rect ||
      !this.#snapshot ||
      !this.#mask
    ) {
      return null;
    }

    const oldRect = this.#rect;
    const newRect = Select.rotateRectCW(oldRect);
    this.#snapshot = Select.rotateSnapshotCW(this.#snapshot, oldRect.width, oldRect.height);
    this.#mask = Select.rotateMaskCW(this.#mask, oldRect.width, oldRect.height);
    this.#rect = newRect;

    return { oldRect, newRect };
  }

  /**
   * Mirrors the active selection's content (and mask) left-right in place
   * (rect is unchanged). No-op (null) unless "selected".
   */
  flipHorizontal(): SelectionRect | null {
    if (
      this.#state !== "selected" ||
      !this.#rect ||
      !this.#snapshot ||
      !this.#mask
    ) {
      return null;
    }

    this.#snapshot = Select.flipSnapshotHorizontal(this.#snapshot, this.#rect.width, this.#rect.height);
    this.#mask = Select.flipMaskHorizontal(this.#mask, this.#rect.width, this.#rect.height);

    return this.#rect;
  }

  /**
   * Mirrors the active selection's content (and mask) top-bottom in place
   * (rect is unchanged). No-op (null) unless "selected".
   */
  flipVertical(): SelectionRect | null {
    if (
      this.#state !== "selected" ||
      !this.#rect ||
      !this.#snapshot ||
      !this.#mask
    ) {
      return null;
    }

    this.#snapshot = Select.flipSnapshotVertical(this.#snapshot, this.#rect.width, this.#rect.height);
    this.#mask = Select.flipMaskVertical(this.#mask, this.#rect.width, this.#rect.height);

    return this.#rect;
  }

  /**
   * Shared tail for restoreRect/selectRegion: both enter "selected" from
   * any prior state with a fully-specified rect/snapshot/mask, clearing any
   * in-progress create/move bookkeeping. Only #skipNextErase differs
   * between the two callers, so it's left to them.
   */
  #enterSelected(
    rect: SelectionRect,
    snapshot: RGBA[],
    mask: boolean[]
  ): void {
    this.#state = "selected";
    this.#rect = rect;
    this.#snapshot = snapshot;
    this.#mask = mask;
    this.#createStart = null;
    this.#moveOrigin = null;
    this.#moveBaseRect = null;
    this.#liveRect = null;
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
    const size = buffer.size();
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

  /**
   * Rotates `rect` 90 degrees clockwise around its center: width/height
   * swap, center point held fixed (rounded, since positions are integer
   * pixels — unavoidable drift when width/height parities differ).
   */
  static rotateRectCW(
    rect: SelectionRect
  ): SelectionRect {
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const width = rect.height;
    const height = rect.width;

    return {
      x: Math.round(centerX - width / 2),
      y: Math.round(centerY - height / 2),
      width,
      height
    };
  }

  /**
   * Rotates a row-major `width`x`height` pixel array 90 degrees clockwise,
   * returning a new `height`x`width` array.
   */
  static rotateSnapshotCW(
    snapshot: RGBA[],
    width: number,
    height: number
  ): RGBA[] {
    return Select.#rotateGridCW(snapshot, width, height);
  }

  /** Same rotation as rotateSnapshotCW, applied to a selection mask. */
  static rotateMaskCW(
    mask: boolean[],
    width: number,
    height: number
  ): boolean[] {
    return Select.#rotateGridCW(mask, width, height);
  }

  /**
   * Mirrors a row-major `width`x`height` pixel array left-right, same
   * dimensions.
   */
  static flipSnapshotHorizontal(
    snapshot: RGBA[],
    width: number,
    height: number
  ): RGBA[] {
    return Select.#flipGridHorizontal(snapshot, width, height);
  }

  /** Same mirroring as flipSnapshotHorizontal, applied to a selection mask. */
  static flipMaskHorizontal(
    mask: boolean[],
    width: number,
    height: number
  ): boolean[] {
    return Select.#flipGridHorizontal(mask, width, height);
  }

  /**
   * Mirrors a row-major `width`x`height` pixel array top-bottom, same
   * dimensions.
   */
  static flipSnapshotVertical(
    snapshot: RGBA[],
    width: number,
    height: number
  ): RGBA[] {
    return Select.#flipGridVertical(snapshot, width, height);
  }

  /** Same mirroring as flipSnapshotVertical, applied to a selection mask. */
  static flipMaskVertical(
    mask: boolean[],
    width: number,
    height: number
  ): boolean[] {
    return Select.#flipGridVertical(mask, width, height);
  }

  static #rotateGridCW<T>(
    grid: T[],
    width: number,
    height: number
  ): T[] {
    const newWidth = height;
    const newHeight = width;
    const result: T[] = new Array(newWidth * newHeight);

    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        const oldX = y;
        const oldY = height - 1 - x;
        result[(y * newWidth) + x] = grid[(oldY * width) + oldX];
      }
    }

    return result;
  }

  static #flipGridHorizontal<T>(
    grid: T[],
    width: number,
    height: number
  ): T[] {
    const result: T[] = new Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        result[(y * width) + x] = grid[(y * width) + (width - 1 - x)];
      }
    }

    return result;
  }

  static #flipGridVertical<T>(
    grid: T[],
    width: number,
    height: number
  ): T[] {
    const result: T[] = new Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        result[(y * width) + x] = grid[((height - 1 - y) * width) + x];
      }
    }

    return result;
  }
}
