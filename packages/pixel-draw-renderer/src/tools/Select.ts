// Import Internal Dependencies
import { pointInRect } from "../utils/math.ts";
import type {
  RGBA,
  SelectionRect,
  Vec2
} from "../types.ts";
import type { DefaultPixelBuffer } from "../buffer/types.ts";
import type { SelectionSnapshot } from "../clipboard/types.ts";

export type SelectState = "idle" | "creating" | "selected" | "moving";

export interface MoveResult {
  source: SelectionRect;
  dest: SelectionRect;
  skipErase: boolean;
}

const kTransparent: RGBA = { r: 0, g: 0, b: 0, a: 0 };

export class Select {
  #state: SelectState = "idle";
  #createStart: Vec2 | null = null;
  #rect: SelectionRect | null = null;
  #snapshot: RGBA[] | null = null;
  #mask: boolean[] | null = null;
  #moveOrigin: Vec2 | null = null;
  #moveBaseRect: SelectionRect | null = null;
  #liveRect: SelectionRect | null = null;
  #floating = false;

  get state(): SelectState {
    return this.#state;
  }

  get rect(): SelectionRect | null {
    return this.#state === "moving" ? this.#liveRect : this.#rect;
  }

  get snapshot(): RGBA[] | null {
    return this.#snapshot;
  }

  get mask(): boolean[] | null {
    return this.#mask;
  }

  /**
   * Whether the content lives only in the floating layer, with no footprint
   * of its own in the buffer yet (a paste). Such a selection must not erase
   * a source when it moves, and must be deposited rather than dropped when
   * it is deselected.
   */
  get floating(): boolean {
    return this.#floating;
  }

  startCreate(
    position: Vec2
  ): SelectionRect {
    this.#state = "creating";
    this.#createStart = position;
    this.#rect = Select.normalizeRect(position, position);
    this.#floating = false;

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

  finishCreate(
    snapshot: RGBA[],
    finalRect?: SelectionRect
  ): void {
    if (this.#state !== "creating") {
      return;
    }

    if (finalRect) {
      this.#rect = finalRect;
    }
    this.#snapshot = snapshot;
    this.#mask = new Array(
      snapshot.length
    ).fill(true);
    this.#state = "selected";
    this.#createStart = null;
  }

  selectRegion(
    rect: SelectionRect,
    snapshot: RGBA[],
    mask: boolean[]
  ): void {
    this.#enterSelected(
      rect,
      snapshot,
      mask
    );
    this.#floating = false;
  }

  /**
   * Masked-out cells are holes, not grab handles: a click through one starts
   * a new selection instead of dragging the shape it belongs to.
   */
  hitTest(
    pos: Vec2
  ): boolean {
    if (
      this.#state !== "selected" ||
      !this.#rect ||
      !this.#mask ||
      !pointInRect(pos, this.#rect)
    ) {
      return false;
    }

    const rect = this.#rect;
    const index = ((pos.y - rect.y) * rect.width) + (pos.x - rect.x);

    return this.#mask[index] === true;
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

    // The move writes the content into the buffer, so it stops floating.
    const skipErase = this.#floating;
    this.#floating = false;

    if (
      source.x === dest.x &&
      source.y === dest.y &&
      !skipErase
    ) {
      return null;
    }

    return {
      source,
      dest,
      skipErase
    };
  }

  restoreRect(
    rect: SelectionRect,
    snapshot: RGBA[],
    mask: boolean[]
  ): void {
    this.#enterSelected(
      rect,
      snapshot,
      mask
    );
    // History replay restores buffer-backed content.
    this.#floating = false;
  }

  clear(): void {
    this.#state = "idle";
    this.#rect = null;
    this.#snapshot = null;
    this.#mask = null;
    this.#createStart = null;
    this.#moveOrigin = null;
    this.#moveBaseRect = null;
    this.#liveRect = null;
    this.#floating = false;
  }

  /**
   * Clears the floating flag without clearing the selection. Keeps `floating`
   * honest for anything that re-enters through the deposit's own commit
   * callbacks, before the deselect that follows resets the whole state.
   */
  markDeposited(): void {
    this.#floating = false;
  }

  markErased(
    eraseColor: RGBA
  ): void {
    if (!this.#rect || !this.#mask || !this.#snapshot) {
      return;
    }

    const mask = this.#mask;
    const snapshot = this.#snapshot;
    this.#snapshot = mask.map(
      (selected, i) => (selected ? eraseColor : snapshot[i])
    );
  }

  exportSnapshot(): SelectionSnapshot | null {
    if (!this.#rect || !this.#snapshot || !this.#mask) {
      return null;
    }

    return {
      rect: {
        ...this.#rect
      },
      pixels: this.#snapshot.map((pixel) => {
        return { ...pixel };
      }),
      mask: [
        ...this.#mask
      ]
    };
  }

  importSnapshot(
    snapshot: SelectionSnapshot
  ): void {
    this.#enterSelected(
      { ...snapshot.rect },
      snapshot.pixels.map((pixel) => {
        return { ...pixel };
      }),
      [...snapshot.mask]
    );
    this.#floating = true;
  }

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
    this.#snapshot = Select.rotateSnapshotCW(
      this.#snapshot,
      oldRect.width,
      oldRect.height
    );
    this.#mask = Select.rotateMaskCW(
      this.#mask,
      oldRect.width,
      oldRect.height
    );
    this.#rect = newRect;

    return { oldRect, newRect };
  }

  flipHorizontal(): SelectionRect | null {
    if (
      this.#state !== "selected" ||
      !this.#rect ||
      !this.#snapshot ||
      !this.#mask
    ) {
      return null;
    }

    this.#snapshot = Select.flipSnapshotHorizontal(
      this.#snapshot,
      this.#rect.width,
      this.#rect.height
    );
    this.#mask = Select.flipMaskHorizontal(
      this.#mask,
      this.#rect.width,
      this.#rect.height
    );

    return this.#rect;
  }

  flipVertical(): SelectionRect | null {
    if (
      this.#state !== "selected" ||
      !this.#rect ||
      !this.#snapshot ||
      !this.#mask
    ) {
      return null;
    }

    this.#snapshot = Select.flipSnapshotVertical(
      this.#snapshot,
      this.#rect.width,
      this.#rect.height
    );
    this.#mask = Select.flipMaskVertical(
      this.#mask,
      this.#rect.width,
      this.#rect.height
    );

    return this.#rect;
  }

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
   * Uses the dominant border color, or `fallback` without in-bounds neighbors.
   */
  static dominantBorderColor(
    buffer: DefaultPixelBuffer,
    rect: SelectionRect,
    fallback: RGBA
  ): RGBA {
    const size = buffer.size();
    const counts = new Map<string, { color: RGBA; count: number; }>();

    function sample(
      x: number,
      y: number
    ): void {
      if (
        x < 0 || x >= size.x ||
        y < 0 || y >= size.y
      ) {
        return;
      }

      const [r, g, b, a] = buffer.samplePixel(x, y);
      const key = `${r},${g},${b},${a}`;
      const entry = counts.get(key);
      if (entry) {
        entry.count++;
      }
      else {
        counts.set(
          key,
          {
            color: { r, g, b, a },
            count: 1
          }
        );
      }
    }

    for (let x = rect.x - 1; x <= rect.x + rect.width; x++) {
      sample(x, rect.y - 1);
      sample(x, rect.y + rect.height);
    }
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      sample(rect.x - 1, y);
      sample(rect.x + rect.width, y);
    }

    let best: RGBA | null = null;
    let bestCount = 0;
    for (const entry of counts.values()) {
      if (entry.count > bestCount) {
        bestCount = entry.count;
        best = entry.color;
      }
    }

    return best ?? fallback;
  }

  /**
   * Keeps local and peer vacated-footprint colors consistent.
   */
  static resolveEraseColor(
    buffer: DefaultPixelBuffer,
    rect: SelectionRect,
    explicitEraseColor: RGBA | null
  ): RGBA {
    if (explicitEraseColor !== null) {
      return explicitEraseColor;
    }

    return Select.dominantBorderColor(buffer, rect, kTransparent);
  }

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

  static rotateSnapshotCW(
    snapshot: RGBA[],
    width: number,
    height: number
  ): RGBA[] {
    return Select.#rotateGridCW(
      snapshot,
      width,
      height
    );
  }

  static rotateMaskCW(
    mask: boolean[],
    width: number,
    height: number
  ): boolean[] {
    return Select.#rotateGridCW(
      mask,
      width,
      height
    );
  }

  static flipSnapshotHorizontal(
    snapshot: RGBA[],
    width: number,
    height: number
  ): RGBA[] {
    return Select.#flipGridHorizontal(
      snapshot,
      width,
      height
    );
  }

  static flipMaskHorizontal(
    mask: boolean[],
    width: number,
    height: number
  ): boolean[] {
    return Select.#flipGridHorizontal(
      mask,
      width,
      height
    );
  }

  static flipSnapshotVertical(
    snapshot: RGBA[],
    width: number,
    height: number
  ): RGBA[] {
    return Select.#flipGridVertical(
      snapshot,
      width,
      height
    );
  }

  static flipMaskVertical(
    mask: boolean[],
    width: number,
    height: number
  ): boolean[] {
    return Select.#flipGridVertical(
      mask,
      width,
      height
    );
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
