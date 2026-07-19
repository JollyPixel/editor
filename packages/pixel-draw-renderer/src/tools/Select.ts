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
 * Manages rectangular and masked selection state.
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
  #skipNextErase = false;

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

  get hasClipboard(): boolean {
    return this.#clipboard !== null;
  }

  get willSkipErase(): boolean {
    return this.#skipNextErase;
  }

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

  finishCreate(
    snapshot: RGBA[]
  ): void {
    if (this.#state !== "creating") {
      return;
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
    this.#skipNextErase = false;
  }

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

    if (
      source.x === dest.x &&
      source.y === dest.y
    ) {
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
    this.#skipNextErase = false;
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
   * Samples the ring of pixels immediately surrounding `rect` and returns
   * the most common color among them, so a vacated footprint blends into
   * its surroundings instead of leaving a flat erase-color hole. Falls
   * back to `fallback` when `rect` has no in-bounds neighbors (e.g. it
   * covers the whole texture).
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
